const searchUserByTarget = async (page, tags) => {
    await page.waitForSelector('button[aria-label="Click to start a search"]', {
        timeout: 100000,
    });

    await page.click('input[aria-label="Search"]');

    await page.waitForSelector('input[aria-label="Search"]', {
        timeout: 50000,
    });

    await page.type('input[aria-label="Search"]', tags);
    await page.keyboard.press("Enter");

    await page.waitForNavigation();

    return page;
};

module.exports = {
    searchUserByTarget,
};
