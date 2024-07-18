const {
    smoothMouseMoveAndClick,
    delayer,
    isDisabled,
    getTime
} = require("../../../utils/helpers");
const Mixpanel = require('mixpanel');
const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);

let message = false;

const addMessageTextByIndex = async (index, nickName, invitationLetters) => {
    const messageTemplate = invitationLetters[index % invitationLetters.length];
    return messageTemplate.replace("/nickName/", nickName);
};


const writeMessage = async (page, nickName, index, invitationLetters) => {
    try {
        message = await addMessageTextByIndex(index, nickName, invitationLetters);
        console.log("---------------------");
        console.log(message);
        console.log("---------------------");
        const textAreaSelector = 'textarea[name="message"]';
        const sendButton = 'button[aria-label="Send invitation"]'; //! send invitation
        const closeNoteButton = 'button[aria-label="Dismiss"]'; //! just close window

        await page.waitForSelector(textAreaSelector, {
            timeout: 100000,
        });

        await delayer(1000);
        await page.type(textAreaSelector, message);
        await delayer(1000);

        const sendBtnIsDisabled = await isDisabled(page, sendButton);
        if (sendBtnIsDisabled) {
            console.log("We click CLOSE");
            await page.click(closeNoteButton);
            console.error("The message was not sent!");
            return false;
        } else {
            console.log("We click SEND");
            await page.click(sendButton); //sendButton
            console.log("Message sended successful");
            return true;
        }
    } catch (error) {
        console.error("Error in message writer");
        return false;
    }
};

const addAndSendMessage = async (page, userName, responseBody, requestBody) => {
    try {
        // ? send without note
        const sendWithoutNoteButton = await page.$(
            'button[aria-label="Send without a note"]'
        );
        const isDisabled = await page.evaluate(button => button.disabled, sendWithoutNoteButton);
        console.log("Finded modal connect button");

        if (sendWithoutNoteButton && !isDisabled) {
            await smoothMouseMoveAndClick(page, sendWithoutNoteButton, 30);
            responseBody.totalInvitationSent++;
            console.log(
                `Is`,
                responseBody.totalInvitationSent,
                `out of`,
                requestBody.totalLettersPerDay,
                `users, his name ${userName}`
            );

            //? send with note
            // const addNoteButton = await page.$('button[aria-label="Add a note"]');
            // if (addNoteButton) {
            //   await smoothMouseMoveAndClick(page, addNoteButton, 30);
            //   const letterHasBeenSent = await writeMessage(
            //       page,
            //       userName,
            //       totalInvitationSent,
            //       invitationLetters
            //   );
            //
            //   if (letterHasBeenSent) {
            //     totalInvitationSent++;
            //     console.log(
            //         `Is`,
            //         totalInvitationSent,
            //         `out of`,
            //         totalClicks,
            //         `users, his name ${userName}`
            //     );
            //   }
        } else {
            console.log("Add a note button not found.");
            const closeButton = await page.$(
                'button[aria-label="Dismiss"]'
            );
            await smoothMouseMoveAndClick(page, closeButton, 30);

        }

        const formatFilters = (filters) => `
      Industry: ${filters.Industry ? filters.Industry.join(', ') : ''}
      Keywords: ${filters.Keywords || ''}
      Locations: ${filters.Locations ? filters.Locations.join(', ') : ''}
      Profile language: ${filters['Profile language'] ? filters['Profile language'].join(', ') : ''}
      "Service Categori": ${filters.Industry ? filters.Industry.join(', ') : ''}
    `;

        // const sendTime = new Date().toISOString();
        const formattedFilters = formatFilters(requestBody.searchFilters);

        mixpanel.track('CONNECT', {
            name_event: 'CONNECT',
            publisher: requestBody.publisher,
            agency: requestBody.agency,
            account: requestBody.id,
            level_of_target: requestBody.levelOfTarget,
            target: requestBody.targetFiltersName,
            sent_time: getTime(),
            sender_username: 'sender_username',
            from_page_url: page.url(),
            cover_letter: message,
            filters_search: formattedFilters,
            keywords: requestBody.searchTags,
            recipient_username: userName,
            limit_invitations_sent_per_day: requestBody.totalLettersPerDay,
            total_invitation_sent: `${responseBody.totalInvitationSent} of ${requestBody.totalLettersPerDay}`,
            totalClicks: responseBody.totalClicks
        }, (err) => {
            if (err) {
                console.error('Error tracking event:', err);
            } else {
                console.log('Event tracked successfully');
            }
        });

        console.log(userName);
        responseBody.userNames.push(userName);

        return responseBody;

    } catch (error) {
        console.error("Error in message sender", error);
        return error;
    }
};

module.exports = {
    addAndSendMessage,
};
