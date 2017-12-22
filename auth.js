#!/usr/bin/env node

const bodyParser = require('body-parser');
const compression = require('compression');
const ensureLogin = require('connect-ensure-login');
const express = require('express');
const fs = require('fs');
const local = require('passport-local');
const passport = require('passport');
const path = require('path');
const proxy = require('express-http-proxy');
const session = require('express-session');
const {spawn} = require('child_process');
const url = require('url');

const TW_PORT = '8888';

let server = null;

function restartServer() {
    if (server) {
        server.kill();
    }
    server = spawn(process.env.TIDDLYWIKI, [
        'wiki',
        '--server',
        TW_PORT,
        '$:/core/save/lazy-images',
        'text/plain',
        'text/html',
        process.env.USERNAME || 'user',
        '',
        '0.0.0.0',
    ]);
};
restartServer();

const user = {
    id: 0,
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
};

const escapeTitle = (title) => title.replace(/[:\/]/g, '_');

const INBOX_TITLE = '$:/plugins/anstosa/tw5-docker/config';
const SITE_TITLE_DATA = '/var/lib/wiki/data/wiki/tiddlers/$__SiteTitle.tid';
let siteTitle = fs.readFileSync(SITE_TITLE_DATA).toString().split('\n');
siteTitle = siteTitle[siteTitle.length - 1];

const INBOX_DATA = `/var/lib/wiki/data/wiki/tiddlers/${escapeTitle(INBOX_TITLE)}.tid`;
let inboxTitle = null;
let inboxPrefix = '';
try {
    const inboxData = fs.readFileSync(INBOX_DATA).toString().split('\n');
    inboxTitle = inboxData[inboxData.length - 2]
    inboxPrefix = inboxData[inboxData.length - 1]
}
catch (error) {}

const app = express();
app.set('view engine', 'ejs');
app.use(compression());
app.use(bodyParser.urlencoded({extended: false}));
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, '../data/wiki/tiddlers/favicon.ico'));
});

// getTimestamp builds and returns a timestamp for the current time in the
// format required for Tiddlers.
function getTimestamp() {
    const now = new Date();
    return [
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
    ].join('');
}

// renderMessage displays the message provided to the user
function renderMessage(message, res) {
    res.render(path.join(__dirname, 'quickStoreMessage.ejs'), {siteTitle, message});
}

function renderForm(req, res, params) {
    params = {
        content: '',
        inboxPrefix,
        inboxTitle,
        index: 0,
        siteTitle,
        tags: '',
        title: '',
        ...params,
    };
    console.log(params);
    res.render(path.join(__dirname, 'quickStoreForm.ejs'), params);
}

// appendToTiddler looks for the file with the provided title, however it only
// replaces spaces in the title with underscores, so it might not work always.
// Updates the modified time, then adds the provided content to the end.
function appendToTiddler(title, content) {
    const fileName = `../data/wiki/tiddlers/${escapeTitle(title)}.tid`;
    if (!title) {
        return {error: 'Please configure the Inbox tab first in Settings'};
    }
    let data;
    try {
        data = fs.readFileSync(fileName);
    }
    catch (error) {
        return {error: `The target file does not exist "${fileName}"`};
    }

    if (data.indexOf(`title: ${title}`) == -1) {
        return {error: `The file "${fileName}" did not contain the expected title`};
    }

    data = String(data);
    data = data.replace(/modified: [0-9]+/ , `modified: ${getTimestamp()}`);
    data += `\n${content}`;

    try {
        fs.writeFileSync(fileName, data);
    }
    catch (error) {
        return {error: `There was a problem updating your file: ${err}`};
    }
    return {success: 'Your file has been updated'};
}

// storeNewTiddler creates a new tiddler, stored in a file based on the title.
function storeNewTiddler(title, tags, content, shouldOverwrite=false) {
    const fileName = `../data/wiki/tiddlers/${escapeTitle(title)}.tid`;
    const now = getTimestamp();

    if (!shouldOverwrite) {
        try {
            fs.openSync(fileName, 'wx');
        } catch (error) {
            if (error.code === 'EEXIST') {
                return {error: 'Unable to save: File already exists!'};
            }
        }
    }

    const fileBody = [
        `created: ${now}`,
        `creator: ${user.username}`,
        `modified: ${now}`,
        `modifier: ${user.username}`,
        `tags: ${tags}`,
        `title: ${title}`,
        `type: text/vnd.tiddlywiki`,
        '',
        content
    ].join('\n');

    try {
        fs.writeFileSync(fileName, fileBody);
    }
    catch (error) {
        return {error: `There was a problem storing your file: ${err}`};
    }
    return {success: 'Your file has been stored'};
}

const proxyHandler = proxy(`localhost:${TW_PORT}`, {
    limit: '25mb',
    parseReqBody: false,
    proxyReqPathResolver: (req) => req.originalUrl,
});

if (user.username && user.password) {
    passport.use(new local.Strategy((username, password, done) => {
        if (
            username !== user.username ||
            password !== user.password
        ) {
            done(null, false, {message: 'Incorrect login'});
        }
        else {
            done(null, user);
        }
    }));
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((userId, done) => {
        if (userId !== user.id) {
            done('Unknown user');
        }
        else {
            done(null, user);
        }
    });
    app.use(session({
        resave: false,
        saveUninitialized: false,
        secret: 'tiddlytiddly',
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    app.get('/style.css', (req, res) => {
        res.sendFile(path.join(__dirname, 'style.css'));
    });

    app.get('/login', (req, res) => {
        res.render(path.join(__dirname, 'login.ejs'), {siteTitle});
    });
    app.post('/login', passport.authenticate('local', {
        successReturnToOrRedirect: '/',
        failureRedirect: '/login',
    }));
    const ensureLoggedIn = ensureLogin.ensureLoggedIn('/login');

    app.get('/quickstore', ensureLoggedIn, renderForm);
    app.post('/quickstore', ensureLoggedIn, (req, res) => {
        // retrieves data from the incoming quick-store request and
        // stores the contents in the TiddlyWiki, based on the options selected
        const {append, inbox, index, prefix, settings, tags, title} = req.body;
        let {content} = req.body;
        let result;

        if (!inbox && !title) {
            result = {error: 'Please provide the Tiddler title'};
        }
        else if (settings) {
            inboxTitle = title;
            inboxPrefix = prefix;
            content = [
                inboxTitle,
                inboxPrefix,
            ].join('\n');
            result = storeNewTiddler(INBOX_TITLE, tags, content, true);
            if (!result.error) {
                result.success = 'Settings saved!';
            }
        }
        else if (append) {
            if (inbox) {
                content = `${inboxPrefix}${content}`;
            }
            result = appendToTiddler(title, content);
        }
        else {
            result = storeNewTiddler(title, tags, content);
        }
        if (result.error) {
            renderForm(req, res, {...req.body, ...result})
        }
        else {
            renderForm(req, res, {index, ...result});
        }
        restartServer();
    });

    app.use('*', ensureLoggedIn, proxyHandler);
}
else {
    app.use('*', proxyHandler);
}
app.listen(8080);
