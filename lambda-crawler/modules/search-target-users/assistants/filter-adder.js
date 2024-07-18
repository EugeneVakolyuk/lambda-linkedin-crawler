const { smoothMouseMoveAndClick, delayer } = require("../../../utils/helpers");
const addFilters = async (page, filters) => {
    const allFilterElements = await page.$$(
        "li.search-reusables__secondary-filters-filter"
    );

    for (const filterElement of allFilterElements) {
        const textElementInFilter = await filterElement.$("h3");
        const targetFilterName = await textElementInFilter.evaluate((el) =>
            el.innerText.trim()
        );

        if (Object.keys(filters).includes(targetFilterName)) {
            let addFilterButton = await filterElement.$("button");

            if (addFilterButton) {
                await smoothMouseMoveAndClick(page, addFilterButton, 50);
                const filtersField = await filterElement.$("input");
                if (filtersField) {
                    for (const value of filters[targetFilterName]) {
                        const index = filters[targetFilterName].indexOf(value);

                        await filtersField.type([value]);

                        await delayer(2500);
                        await page.keyboard.press("ArrowDown");

                        await delayer(1000);
                        await page.keyboard.press("Enter");

                        await delayer(2000);

                        addFilterButton = await filterElement.$("button");
                        if (index !== filters[targetFilterName].length - 1) {
                            await smoothMouseMoveAndClick(page, addFilterButton, 50);
                        }
                    }
                }
            } else if (targetFilterName === "Profile language") {
                for (const value of filters[targetFilterName]) {
                    const languageLabel = await filterElement.$(
                        `label[for='advanced-filter-profileLanguage-${value}']`
                    );
                    await smoothMouseMoveAndClick(page, languageLabel, 50);
                }
                await delayer(1000);
            } else if (targetFilterName === "Keywords") {
                const languageLabels = await filterElement.$$("label");
                for (const label of languageLabels) {
                    const labelText = await page.evaluate(
                        (el) => el.innerText.trim(),
                        label
                    );
                    if (labelText === "Title") {
                        const keyWardsField = await label.$("input");
                        if (keyWardsField) {
                            await keyWardsField.type(filters["Keywords"]);
                            await delayer(1000);
                        }
                    }
                }
            }
        }
    }
};

module.exports = {
    addFilters,
};
