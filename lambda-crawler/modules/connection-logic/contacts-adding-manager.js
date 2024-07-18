const {
    enableCursor,
    smoothMouseMoveAndClick,
    delayer,
    scrollToElement,
    nextPageNavigation,
    isDisabled,
} = require("../../utils/helpers");
const { getUserName } = require("./assistants/get-user-name");
const { addAndSendMessage } = require("./assistants/message-sender");


const contactsAddingManager = async (page, responseBody, requestBody) => {
    let currentPage = 1;

    while (responseBody.totalInvitationSent < requestBody.totalLettersPerDay) {
        await delayer(5000);
        await enableCursor(page);

        const divsWithButtonsToConnect = await page.$$(
            ".entity-result__actions.entity-result__divider"
        );

        // // Searching total "Connect" button on page
        //
        // const divsWithUserImage = await page.$$(
        //     ".entity-result__universal-image"
        // );

        // let connectButtonCount = 0;
        //
        // for (let connectDiv of divsWithButtonsToConnect) {
        //     const connectionButton = await connectDiv.$("button");
        //
        //     if (connectionButton) {
        //         const buttonText = await connectionButton.evaluate((el) =>
        //             el.innerText.trim()
        //         );
        //
        //         if (buttonText === "Connect") {
        //             connectButtonCount++;
        //         }
        //     }
        // }
        //
        // // Searching "Connect" button in user profile
        // for (let userImageDiv of divsWithUserImage) {
        //     const userLink = await userImageDiv.$("a");
        //     if (userLink) {
        //         await smoothMouseMoveAndClick(page, userLink, 50);
        //
        //         console.log(1);
        //         await page.waitForNavigation();
        //         console.log(2);
        //         await page.waitForSelector('button[aria-label="More actions"]', {
        //             timeout: 100000,
        //         });
        //         console.log(3);
        //
        //         const moreActionsButtons = await page.$$('button[aria-label="More actions"]');
        //         const moreActionsButton = moreActionsButtons[1];
        //         await smoothMouseMoveAndClick(page, moreActionsButton, 50);
        //
        //         if (moreActionsButton) {
        //             const connectButtons = await page.evaluate(() => {
        //                 return Array.from(document.querySelectorAll('div[role="button"]'))
        //                     .filter(el => el.getAttribute('aria-label')?.includes('Invite') && el.getAttribute('aria-label')?.includes('to connect'))
        //                     .map(el => el.getAttribute('id')); // Get element IDs
        //             });
        //
        //             let userName;
        //             try {
        //             const secondButtonId = connectButtons[1];
        //             const connectButton = await page.$(`#${secondButtonId}`);
        //
        //             userName = await getUserName(connectButton);
        //
        //             await smoothMouseMoveAndClick(page, connectButton, 50);
        //
        //             totalInvitationSent = await addAndSendMessage(page, userName, totalInvitationSent, totalLettersPerDay, invitationLetters, searchFilters, searchTags, id);
        //
        //             if (totalInvitationSent >= totalLettersPerDay) {
        //                 console.log("Log out");
        //                 return;
        //             }
        //
        //             await page.goBack();
        //
        //             } catch (error) {
        //                 await page.goBack();
        //             }
        //         } else {
        //             console.log(`Button 'Connect' not found.`);
        //         }
        //     }
        // }

        for (let connectDiv of divsWithButtonsToConnect) {
            const connectionButton = await connectDiv.$("button");

            if (connectionButton) {
                const userName = await getUserName(connectionButton);
                const buttonText = await connectionButton.evaluate((el) =>
                    el.innerText.trim()
                );

                if (buttonText === "Connect") {
                    await smoothMouseMoveAndClick(page, connectionButton, 50);
                    console.log(`Button 'Connect' clicked.`);
                    await delayer(1000);

                    responseBody = await addAndSendMessage(page, userName, responseBody, requestBody);
                    // await waitForUserInput('Press any key to continue...');

                    await delayer(500);


                    // check for a warning window from LinkedIn about limits
                    const modalHasChildren = await page.evaluate(() => {
                        const outlet = document.querySelector('#artdeco-modal-outlet');
                        return outlet && outlet.children.length > 0;
                    });

                    if (modalHasChildren) {
                        console.log('The div contains elements.');
                        const modalHeaderElement = await page.$('div.artdeco-modal__header > h2');
                        if (modalHeaderElement) {
                            const headerText = await page.evaluate(element => element.textContent, modalHeaderElement);
                            console.log(headerText);

                            if (headerText && /You’ve reached the weekly invitation limit/.test(headerText)) {
                                console.log("The limit has been reached");
                                responseBody.error = 'The limit has been reached';
                                return responseBody;
                            } else {
                                const modalButtonElement = await page.$('#artdeco-modal-outlet button[aria-label="Got it"]');
                                if (modalButtonElement) {
                                    await smoothMouseMoveAndClick(page, modalButtonElement, 30);
                                }
                            }
                        }
                    } else {
                        console.log('No modal windows were detected');
                    }

                    if (responseBody.totalInvitationSent >= requestBody.totalLettersPerDay) {
                        console.log("Task completed, ending function...");
                        return responseBody;
                    }
                }
            }
        }

        try {
            const footer = await page.$("footer");
            await scrollToElement(page, footer);
            await delayer(1000);
            await scrollToElement(page, footer);
            await delayer(1000);

            const nextPageButtonSelector = 'button[aria-label="Next"]';
            let nextPageButton = await page.$(nextPageButtonSelector);
            const buttonIsDisabled = await isDisabled(page, nextPageButtonSelector);

            if (buttonIsDisabled || !nextPageButton) {
                console.log("It was the last page");
                return responseBody;
            }

            // await delayer(1000);
            if (currentPage > 1) {
                nextPageButton = await page.$(nextPageButtonSelector);
            }
            const newPage = await nextPageNavigation(page, nextPageButton, currentPage);
            currentPage++;

            if (!newPage) {
                console.error('New page is not available');
                break;
            }
        } catch (error) {
            console.error('Error when going to the next page:', error);
        }
    }

    return responseBody;
};

module.exports = {
    contactsAddingManager,
};
