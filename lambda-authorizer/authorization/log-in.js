const { delayer } = require("../utils/helpers");
const { getVerificationCode } = require("./user-data.js")

let logInStatus = {
    isLinkedinAuth: false,
    message: ''
}

const logIn = async (page, email, password, id) => {
    await page.goto("https://www.linkedin.com/feed/");
    await delayer(7000);

    let title = await page.title();
    title = await page.title();
    console.log("Title 1:", title);

    if (!title.includes('Feed | LinkedIn')) {
        await page.type('input[name="session_key"]', email);
        await page.type('input[name="session_password"]', password);

        await page.waitForSelector('button[type="submit"]', {
            timeout: 10000,
        });
        await page.click('button[type="submit"]');

        // await page.waitForNavigation();
        await delayer(7000);

        title = await page.title();
        console.log("Title 2:", title);
        await delayer(2000);
        let isCaptcha = await page.$('iframe#captcha-internal') !== null;

        // Надсилаємо код замість підтвердження в додатку
        if (title.includes('LinkedIn App Challenge')) {
            await page.mouse.click(718, 530);
            await delayer(2000);
            title = await page.title();
            console.log("Title 2.1:", title);
        }



        if (title.includes('Security Verification')) {
            if (await page.$('input[placeholder="Enter code"]')) {
                const verificationCode = await getVerificationCode(id);
                console.log("Recived code:", verificationCode);
                await page.type('input[placeholder="Enter code"]', verificationCode);
                page.click('button[type="submit"]')
                // page.waitForNavigation({ waitUntil: 'networkidle0' }), // Чекаємо на завершення навігації
                await delayer(20000);
                title = await page.title();
                console.log("Title 3:", title);

                if (title.includes('Security Verification')) {
                    console.log("Verification failed");
                    logInStatus.message = "Verification failed";
                    logInStatus.isLinkedinAuth = false;
                } else {
                    console.log("Login successful");
                    logInStatus.message = "Login successful";
                    logInStatus.isLinkedinAuth = true;
                }
            } else {
                console.log("Login successful");
                logInStatus.message = "Login successful";
                logInStatus.isLinkedinAuth = true;
            }
        } else if (isCaptcha) {
            console.log('CAPTCHA detected');
            logInStatus.message = "CAPTCHA detected";
            logInStatus.isLinkedinAuth = false;
            // try {
            //   await solveCapcha(page);
            // } catch (error) {
            //   console.error("Capcha solving error:", error);
            //   await delayer(3000000);
            // }
        } else {
            console.log("There is not field element")
        }
    } else {
        console.log("You are already logged in");
        logInStatus.message = "You are already logged in";
        logInStatus.isLinkedinAuth = true;
    };

// відхиилти кукі
    // const buttons = await page.$$('.artdeco-global-alert__action');

    // // Перевірити кожну кнопку на наявність тексту "Reject"
    // for (const button of buttons) {
    //   const text = await button.$eval('span.artdeco-button__text', span => span.textContent.trim());
    //   if (text === 'Reject') {
    //     await button.click();
    //     console.log('Reject button clicked');
    //     break;
    //   }
    // }

    return logInStatus;

};


module.exports = {
    logIn,
};
