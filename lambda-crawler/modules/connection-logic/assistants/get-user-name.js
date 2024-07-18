const getUserName = async (element) => {
    const ariaLabel = await element.evaluate((el) =>
        el.getAttribute("aria-label")
    );
    const match = ariaLabel.match(/Invite (.*) to connect/);
    if (match) return match[1];
};

module.exports = {
    getUserName,
};