const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const s3 = new AWS.S3();

const BUCKET_NAME = 'linkedin-user-data';
const USER_DATA_KEY = 'user-data';


async function downloadUserData(username) {
    console.log(username);
    const userDataPath = path.join('/tmp', 'user-data');
    fs.mkdirSync(userDataPath, { recursive: true });

    const params = {
        Bucket: BUCKET_NAME,
        Prefix: `${username}/`,
    };
    const data = await s3.listObjectsV2(params).promise();

    for (const file of data.Contents) {
        const filePath = path.join(userDataPath, file.Key.replace(`${username}/`, ''));

        // Перевірка, чи є filePath директорією
        if (file.Key.endsWith('/')) {
            fs.mkdirSync(filePath, { recursive: true });
        } else {
            const fileParams = {
                Bucket: BUCKET_NAME,
                Key: file.Key,
            };
            const fileData = await s3.getObject(fileParams).promise();
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, fileData.Body);
        }
    }

    return userDataPath;
}

async function uploadUserData(username) {
    console.log(username);
    const userDataPath = path.join('/tmp', 'user-data');

    async function uploadDirectory(directory, s3Path) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const localPath = path.join(directory, file);
            const s3FilePath = path.join(s3Path, file);

            if (fs.lstatSync(localPath).isDirectory()) {
                await uploadDirectory(localPath, s3FilePath);
            } else {
                const fileData = fs.readFileSync(localPath);
                const params = {
                    Bucket: BUCKET_NAME,
                    Key: s3FilePath,
                    Body: fileData,
                };
                await s3.putObject(params).promise();
            }
        }
    }

    await uploadDirectory(userDataPath, `${username}`);
}

async function cleanUpTmpDir() {
    const tmpDir = '/tmp';
    fs.readdir(tmpDir, (err, files) => {
        if (err) {
            console.error(`Failed to list contents of directory: ${err}`);
            return;
        }
        files.forEach((file) => {
            const filePath = path.join(tmpDir, file);
            fs.lstat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Failed to get stats of file: ${err}`);
                    return;
                }
                if (stats.isDirectory()) {
                    fs.rm(filePath, { recursive: true }, (err) => {
                        if (err) {
                            console.error(`Failed to remove directory: ${err}`);
                        }
                    });
                } else {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(`Failed to remove file: ${err}`);
                        }
                    });
                }
            });
        });
    });

    console.log('/tmp has been deleted')
}

async function uploadScreenshot(page, id, screenshotPath) {
    const dir = path.dirname(screenshotPath);
    fs.mkdirSync(dir, { recursive: true }); // створюємо директорію, якщо вона не існує

    await page.screenshot({ path: screenshotPath });

    const screenshotData = fs.readFileSync(screenshotPath);

    const params = {
        Bucket: BUCKET_NAME,
        Key: `screenshots/${id}/${path.basename(screenshotPath)}`,
        Body: screenshotData,
    };
    await s3.putObject(params).promise();
}

module.exports = {
    uploadUserData,
    downloadUserData,
    uploadScreenshot,
    cleanUpTmpDir
};