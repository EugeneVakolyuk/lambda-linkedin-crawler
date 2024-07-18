const chromium = require("@sparticuz/chromium");
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const { delayer, getTime } = require("./utils/helpers.js");
const { downloadUserData, uploadUserData, uploadScreenshot, cleanUpTmpDir } = require("./modules/authorization/user-data.js");
const { searchUserByTarget } = require("./modules/search-target-users/teg-filtration.js");
const { getUsersListByFilters } = require("./modules/search-target-users/user-filters-handler.js");
const { contactsAddingManager } = require("./modules/connection-logic/contacts-adding-manager.js");

const puppeteerExtra = addExtra(require('puppeteer-core')); //const puppeteerExtra = addExtra(require('puppeteer-core'));
puppeteerExtra.use(StealthPlugin());

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const tableName = 'LambdaTasks';

exports.handler = async (event) => {
    console.log("Function is called");
    // Receive data from API
    const imgPath = path.join('/tmp', 'img');
    fs.mkdirSync(imgPath, { recursive: true });
    const screenshotPath = path.join(imgPath, 'screenshot.png');

    const requestBody = JSON.parse(event.body);
    const id = requestBody.id !== null ? requestBody.id : (() => { throw new Error('ID is null') })();
    const searchTags = requestBody.searchTags !== null ? requestBody.searchTags : (() => { throw new Error('Search Tags are null') })();
    const searchFilters = requestBody.searchFilters !== null ? requestBody.searchFilters : (() => { throw new Error('Search Filters are null') })();
    const totalLettersPerDay = requestBody.totalLettersPerDay !== null ? requestBody.totalLettersPerDay : (() => { throw new Error('Total Letters Per Day is null') })();

    // Переведення totalLettersPerDay на числове значення, якщо це необхідно
    if (typeof totalLettersPerDay !== 'number') {
        totalLettersPerDay = Number(totalLettersPerDay);
        if (isNaN(totalLettersPerDay)) {
            // Обробка помилки: значення не може бути перетворене на число
            throw new Error('Total Letters Per Day must be a number');
        }
    }

    console.log(id);
    console.log(totalLettersPerDay, searchTags, searchFilters);

    const userDataPath = await downloadUserData(id);

    const browser = await puppeteerExtra.launch({
        args: chromium.args.filter(arg => arg !== '--disable-notifications'),
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        userDataDir: userDataPath ? userDataPath : path.join('/tmp', 'user-data'),
        ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.setViewport({
        width: 1440,
        height: 760,
        deviceScaleFactor: 1,
    });

    await page.exposeFunction('incrementClickCount', () => {
        responseBody.totalClicks += 1;
        // console.log(`Total clicks: ${responseBody.totalClicks}`);
    });

    const countClicks = async (page) => {
        await page.evaluate(() => {
            document.addEventListener('click', () => {
                window.incrementClickCount();
            });
        });
    };

    let responseBody = {
        error: null,
        time: null,
        id: id,
        publisher: requestBody.publisher,
        agency: requestBody.agency,
        targetFiltersName: requestBody.targetFiltersName,
        levelOfTarget: requestBody.levelOfTarget,
        totalClicks: 0,
        totalLettersPerDay: totalLettersPerDay,
        totalInvitationSent: 0,
        searchTags: searchTags,
        searchFilters: searchFilters,
        userNames: [],
    };

    console.log('responseBody.id', responseBody.id);

    try {
        responseBody.time = await getTime();

        await page.goto("https://www.linkedin.com/feed/");
        await delayer(7000);

        let title = await page.title();
        title = await page.title();
        console.log("Title 1:", title);

        if (title.includes('Feed | LinkedIn')) {
            // Keyword search
            const searchBytTagPage = await searchUserByTarget(page, searchTags);
            if (searchBytTagPage) {
                console.log("Searching by tag name successful!");
                await countClicks(searchBytTagPage);
            } else {
                console.log("Searching by tag name did not loaded.");
            }

            // Filtration
            const usersListPage = await getUsersListByFilters(searchBytTagPage, searchFilters);
            if (usersListPage) {
                console.log("Users list loaded successful!");
                await countClicks(usersListPage);
            } else {
                console.log("Users list did not loaded.");
            }

            // Invitation cycle
            await delayer(5000);
            await uploadScreenshot(page, id, screenshotPath);
            console.log('Screenshot uploaded');
            responseBody = await contactsAddingManager(page, responseBody, requestBody);
        } else {
            console.log("Not authorized");
            await endFunction(page, "Not authorized", responseBody, screenshotPath);
        }

    } catch (error) {
        await endFunction(page, error, responseBody, screenshotPath);
    }

    await endFunction(page, false, responseBody, screenshotPath);
};


const endFunction = async (page, error, responseBody, screenshotPath) => {
    const responseJson = {
        ...responseBody,
        execution: {
            screenshotSaved: false,
            userDataUploaded: false,
            tmpDirCleaned: false,
            responseSended: true
        }
    };

    if (error) {
        console.error("Error:", error);
        responseJson.execution.error = error;
    }

    try {
        // Завантажити скриншот в S3
        await uploadScreenshot(page, responseBody.id, screenshotPath);
        responseJson.execution.screenshotSaved = true;
    } catch (screenshotError) {
        console.error("Screenshot Error:", screenshotError);
        responseJson.execution.screenshotUploadError = screenshotError;
    }

    try {
        // Зберігання оновлених даних користувача
        await uploadUserData(responseBody.id);
        responseJson.execution.userDataUploaded = true;
    } catch (uploadError) {
        console.error("Upload Error:", uploadError);
        responseJson.execution.dataUploadError = uploadError;
    }

    try {
        // Очищення тимчасової директорії
        await cleanUpTmpDir();
        responseJson.execution.tmpDirCleaned = true;
    } catch (cleanUpError) {
        console.error("Clean Up Error:", cleanUpError);
        responseJson.execution.cleanUpError = cleanUpError;
    }

    try {
        const taskId = responseBody.id;

        // Оновлюємо статус у DynamoDB
        await dynamoDB.update({
            TableName: tableName,
            Key: { taskId },
            UpdateExpression: 'set #status = :status, #result = :result',
            ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
            ExpressionAttributeValues: {
                ':status': 'completed',
                ':result': JSON.stringify(responseJson)
            }
        }).promise();
    } catch(responseError) {
        console.error("Response Error:", responseError);
        responseJson.execution.responseSended = false;
        responseJson.execution.responseError = responseError;
    }

    console.log("Function ended!");

    console.log(JSON.stringify(responseJson));

    return {
        statusCode: error ? 500 : 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Дозволяє CORS
            'Access-Control-Allow-Methods': 'POST', // Дозволені методи
        },
        body: JSON.stringify(responseJson)
    };
};
