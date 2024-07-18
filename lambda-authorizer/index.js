const chromium = require("@sparticuz/chromium");
const { addExtra } = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const { logIn } = require("./authorization/log-in.js");
const { downloadUserData, uploadUserData, uploadScreenshot, cleanUpTmpDir } = require("./authorization/user-data.js");

const puppeteerExtra = addExtra(require('puppeteer-core'));
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
    const email = requestBody.email !== null ? requestBody.email : (() => { throw new Error('Email is null') })();
    const password = requestBody.password !== null ? requestBody.password : (() => { throw new Error('Password is null') })();
    console.log(id, email, password);

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

    let logInStatus;

    try {
        // Authorization
        logInStatus = await logIn(page, email, password, id);
    } catch (error) {
        await endFunction(page, error, id, logInStatus, screenshotPath);
    }

    await endFunction(page, false, id, logInStatus, screenshotPath);
};


const endFunction = async (page, error, id, logInStatus, screenshotPath) => {
    const responseJson = {
        id: id,
        ...logInStatus,
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
        await uploadScreenshot(page, id, screenshotPath);
        responseJson.execution.screenshotSaved = true;
    } catch (screenshotError) {
        console.error("Screenshot Error:", screenshotError);
        responseJson.execution.screenshotUploadError = screenshotError;
    }

    try {
        // Зберігання оновлених даних користувача
        await uploadUserData(id);
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
        const taskId = id;

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