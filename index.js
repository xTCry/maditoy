const fs = require('fs');
const { VK } = require('vk-io');
const youtubedl = require('youtube-dl');
require('dotenv').config();

const withoutVideoSave = process.env.VIDEO_SAVE == 'false';

const vkLongPool = new VK({
    token: process.env.TOKEN_LP,
});
const vkUploader = process.env.TOKEN_UP && new VK({
    token: process.env.TOKEN_UP,
}) || vkLongPool;

const regExpYT = new RegExp('(?:http(?:s)?:\/\/)?(?:www\\.)?(?:m\\.)?(?:youtu\\.be\/|youtube\\.com\/(?:(?:watch)?\\?(?:.*&)?v(?:i)?=|(?:embed|v|vi|user)\/))([\\w\\d]{0,11})', 'i');
const regExpVK = new RegExp(`^md ${regExpYT.toString().slice(1, -2)}`, 'i');

vkLongPool.updates
    .hear(regExpVK, async (context) => {
        let math = context.text.match(regExpYT);
        if (math.length > 1 && math[1]) {
            let videoID = math[1];
            context.send(`Пошла загрузочка...`);

            try {
                let videoAttachment = await GO(`http://www.youtube.com/watch?v=${videoID}`, true);
                context.send({
                    message: `Видео. ${genDesc(videoID)}`,
                    attachment: videoAttachment,
                });
            } catch (e) {
                context.send(`Произола ошибка... ${e.message}`);
                console.error(e);
            }
        }
    })
    .start()
    .then(() => {
        const isGroup = !!vkLongPool.options.pollingGroupId;

        console.log('isGroup', isGroup);
    })
    .catch(console.error);


/* FNUCTIONS */

const GO = async (url, upload = false, peer = null) => {
    let info = await getInfo(url);
    // console.log('INFO: ', info);

    let output = `${__dirname}/videos/${info.id}.mp4`;
    if (withoutVideoSave && upload) {
        output = await downloadMe(info);
    }
    else {
        let downloaded = fs.existsSync(output) ? fs.statSync(output).size : 0;
        if (!downloaded || downloaded >= info.size) {
            await downloadMe(info, output);
        }
        else {
            console.log(`Video [${info.id}] "${info.title}" already downloaded.`);
        }
    }

    if (upload) {
        let videoAttachment = await uploadVK(output, info.title, genDesc(info.id), peer);
        return videoAttachment;
    }

    return null;
};

const getInfo = async (url) => new Promise((resolve, reject) => youtubedl.getInfo(url, [], (err, info) => {
    if (err) reject(err); else resolve(info);
}));

const downloadMe = async (data, output = false) => new Promise((resolve, reject) => {
    let downloaded = output && fs.existsSync(output) ? fs.statSync(output).size : 0;

    const video = youtubedl(data, [], { start: downloaded, cwd: __dirname });
    let resultInfo = {};

    video.on('error', (err) => {
        reject(err);
    });

    video.on('info', (info) => {
        console.log('Download started');

        let total = info.size + downloaded;
        console.log('size: ' + total);

        if (downloaded > 0) {
            console.log('resuming from: ' + downloaded);
            console.log('remaining bytes: ' + info.size);
        }
    });

    video.on('end', () => {
        console.log('finished downloading!');
        resolve(resultInfo);
    });

    if (output) {
        video.pipe(fs.createWriteStream(output, { flags: 'a' }));
    }
    else {
        resolve(video);
    }
});

const uploadVK = async (output, name = Date.now(), description = undefined, peer_id = null) => {
    const sourceValues = [typeof output === 'string' ? fs.createReadStream(output) : output];

    let videoAttachment = await vkUploader.upload.video({
        name,
        description,
        is_private: 1,
        source: {
            timeout: 60e3 * 5,
            values: sourceValues,
        },
    });
    console.log('Video uploaded', videoAttachment);

    // Send message att video
    if (peer_id) {
        vkLongPool.api.messages.send({
            attachment: videoAttachment,
            message: `Видео. ${description}`,
            peer_id,
        });
    }

    return videoAttachment;
};

const wm = '​﻿​﻿​﻿‌﻿​﻿‌﻿‌﻿‍﻿‏﻿​﻿​﻿​﻿​﻿‍﻿‌﻿‍﻿‌﻿‏﻿​﻿​﻿​﻿‌﻿‌﻿‌﻿‍﻿‍﻿‏﻿​﻿​﻿​﻿​﻿‌﻿‌﻿​﻿​﻿‏﻿​﻿​﻿​﻿‌﻿‌﻿‌﻿‍﻿‌﻿‏﻿​﻿​﻿​﻿‌﻿​﻿​﻿‍﻿‌﻿‏﻿​﻿​﻿​﻿​﻿‍﻿‌﻿‍﻿‍﻿‏﻿​﻿​﻿​﻿‌﻿‌﻿‌﻿​﻿‌﻿‏﻿​﻿​﻿​﻿‌﻿‌﻿‌﻿‍﻿‍﻿‏﻿​﻿​﻿​﻿‌﻿​﻿‌﻿‍﻿‌';
const genDesc = (id) => `Скачано​‌${wm} с (https://youtu.be/${id})`;


/* INITIALIZE */

(async () => {
    // await GO('https://youtu.be/C0DPdy98e4c');
})();
