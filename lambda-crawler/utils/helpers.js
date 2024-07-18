const readline = require('readline');

const getTime = async () => {
    const time = new Date();

    const optionsTime = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    };

    const formattedTime = new Intl.DateTimeFormat('en-US', optionsTime).format(time);
    console.log("Formatted time:", formattedTime);  // Логування для перевірки часу
    return formattedTime;
};

function waitForUserInput(text) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

const delayer = (time) => new Promise((resolve) => setTimeout(resolve, time));

const enableCursor = async (page) => {
    await page.evaluate(() => {
        const cursor = document.createElement("div");
        cursor.style.width = "10px";
        cursor.style.height = "10px";
        cursor.style.position = "absolute";
        cursor.style.borderRadius = "5px";
        cursor.style.backgroundColor = "red";
        cursor.style.zIndex = "10000";
        cursor.style.pointerEvents = "none"; // забезпечити, щоб курсор не взаємодіяв з елементами UI
        document.body.appendChild(cursor);

        document.addEventListener("mousemove", (event) => {
            cursor.style.left = event.pageX + "px";
            cursor.style.top = event.pageY + "px";
        });
    });
};
const smoothMouseMoveAndClick = async (page, element, steps) => {
    await page.evaluate((el) => {
        //Скрол сторінки
        el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
        });
    }, element);
    await delayer(1000);

    const box = await element.boundingBox(); // Обраховуємо координати блока, щоб передвигати до нього курсор
    if (!box) {
        console.log("Unable to retrieve bounding box");
        return;
    }

    let startY;
    let startX;
    let endX = box.x + box.width / 2; // Знаходим центр координат блока
    let endY = box.y + box.height / 2;

    if (!startY || !startX) {
        // Якщо ще не оголошували початкові координати (звідки буде рухатись курсор), то задаєм статичне значення
        startY = 400;
        startX = 400;
    }

    // Просто прийми це. Ця функція рухає курсор від початкових до кінцевих координат
    let dx = (endX - startX) / steps;
    let dy = (endY - startY) / steps;
    for (let i = 1; i <= steps; i++) {
        let x = startX + dx * i;
        let y = startY + dy * i;
        await page.mouse.move(x, y);
        await delayer(5); // Не змінювати
    }

    await page.mouse.click(endX, endY); // Клікаєм саме по КООРДИНАТАХ, а не на елемент
};
const scrollToElement = async (page, element) => {
    await page.evaluate((el) => {
        el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
        });
    }, element);
    await delayer(1000);
};
const nextPageNavigation = async (page, btn, currentPage) => {
    console.log("Going to page", currentPage + 1);
    await smoothMouseMoveAndClick(page, btn, 20);
    await page.waitForNavigation();
    return page;
};
const isDisabled = async (page, buttonSelector) => {
    const isButtonDisabled = await page.evaluate((selector) => {
        const button = document.querySelector(selector);
        if (button) {
            return button.disabled;
        } else {
            return null;
        }
    }, buttonSelector);

    if (isButtonDisabled === null) {
        return false;
    } else {
        return isButtonDisabled;
    }
};
module.exports = {
    waitForUserInput,
    delayer,
    enableCursor,
    smoothMouseMoveAndClick,
    scrollToElement,
    nextPageNavigation,
    isDisabled,
    getTime,
};
