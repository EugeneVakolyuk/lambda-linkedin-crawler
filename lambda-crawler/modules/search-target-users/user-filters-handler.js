const {
    enableCursor,
    smoothMouseMoveAndClick,
    delayer,
} = require("../../utils/helpers");
const { addFilters } = require("./assistants/filter-adder");

const getUsersListByFilters = async (page, searchFilters) => {
    await page.waitForSelector("button.search-reusables__filter-pill-button", {
        timeout: 5000,
    });
    let allFilterButtons = await page.$$(
        "button.search-reusables__filter-pill-button"
    );
    for (const filterButton of allFilterButtons) {
        const buttonText = await page.evaluate((el) => el.innerText, filterButton);
        if (buttonText.includes("People")) {
            await filterButton.click();
            break;
        }
    }
    await page.waitForNavigation();

    if (Object.keys(searchFilters).length > 0) {
        await page.waitForSelector(
            'button[aria-label="Show all filters. Clicking this button displays all available filter options."]'
        );
        const allFilters = await page.$(
            'button[aria-label="Show all filters. Clicking this button displays all available filter options."]'
        );
        await enableCursor(page);
        await smoothMouseMoveAndClick(page, allFilters, 50);

        await addFilters(page, searchFilters);
        await delayer(5000);
        await page.waitForSelector("button.search-reusables__filter-pill-button", {
            timeout: 5000,
        });
        await page.click(
            'button[aria-label="Apply current filters to show results"]'
        );
        await page.waitForNavigation();
        return page;
    }

    return page;
};

module.exports = {
    getUsersListByFilters,
};
