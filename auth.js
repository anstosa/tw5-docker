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

const server = spawn(process.env.TIDDLYWIKI, [
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
server.on('close', (code) => console.error(`TiddlyWiki crashed: ${code}`));

const user = {
    id: 0,
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
};

const SITE_TITLE_DATA = '/var/lib/wiki/data/wiki/tiddlers/$__SiteTitle.tid';
let siteTitle = fs.readFileSync(SITE_TITLE_DATA).toString().split('\n');
siteTitle = siteTitle[siteTitle.length - 1];
console.log(siteTitle);

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
    let now = new Date();
    return ('' + now.getFullYear() + (now.getMonth() + 1) +
        now.getDate() + now.getHours() + now.getMinutes() + now.getSeconds() +
        now.getMilliseconds());
}

// renderMessage displays the message provided to the user
function renderMessage(message, res) {
    res.render(path.join(__dirname, 'quickStoreMessage.ejs'), {siteTitle, message});
}

// appendToTiddler looks for the file with the provided title, however it only
// replaces spaces in the title with underscores, so it might not work always.
// Updates the modified time, then adds the provided content to the end.
function appendToTiddler(title, content, res) {
    //var fileTitle = title.replace(' ', '_');
    // It looks like spaces are usually preserved in filenames
    var fileTitle = title;

    var fileName = '../data/wiki/tiddlers/' + fileTitle + '.tid';
    fs.readFile(fileName, (err, data) => {
        if (err) {
            renderMessage('There was a problem reading the file "' + fileName + '"', res);
            return;
        }

        if (!data.indexOf('title: title')) {
            renderMessage('The file "' + fileName + '" did not contain the expected title', res);
            return;
        }

        data = String(data);
        data = data.replace(/modified: [0-9]+/ ,'modified: ' + getTimestamp());
        data += '\n' + content;

        fs.writeFile(fileName, data, function(err) {
            if(err) {
                renderMessage('There was a problem updating your file: ' + err, res);
            } else {
                renderMessage('Your file has been updated', res);
            }
        });
    });
}

// storeNewTiddler creates a new tiddler, stored in a file based on the title.
function storeNewTiddler(title, tags, content, res) {
    //var fileTitle = title.replace(' ', '_');
    // It looks like spaces are usually preserved in filenames
    var fileTitle = title;

    var fileName = '../data/wiki/tiddlers/' + fileTitle + '.tid';
    var now = getTimestamp();

    var fileBody = 'created: ' + now + '\n';
    fileBody += 'creator: ' + user.username + '\n';
    fileBody += 'modified: ' + now + '\n';
    fileBody += 'modifier: ' + user.username + '\n';
    fileBody += 'tags: ' + tags + '\n';
    fileBody += 'title: ' + title + '\n';
    fileBody += 'type: text/vnd.tiddlywiki\n';
    fileBody += '\n' + content;

    fs.writeFile(fileName, fileBody, function(err) {
        if(err) {
            renderMessage('There was a problem storing your file: ' + err, res);
        } else {
            renderMessage('Your file has been stored', res);
        }
    });
}

// quickStoreAction retrieves data from the incoming quick-store request and
// stores the contents in the TiddlyWiki, based on the options selected.
function quickStoreAction(req, res) {
    var title = req.body.title;
    var content = req.body.content;
    var tags = req.body.tags;
    var append = req.body.append;

    if (append) {
        appendToTiddler(title, content, res);
    } else {
        storeNewTiddler(title, tags, content, res);
    }
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
    app.get('/login', (req, res) => {
        res.render(path.join(__dirname, 'login.ejs'), {siteTitle});
    });
    app.post('/login', passport.authenticate('local', {
        successReturnToOrRedirect: '/',
        failureRedirect: '/login',
    }));

    app.get('/quickstore', ensureLogin.ensureLoggedIn('/login'), (req, res) => {
        res.render(path.join(__dirname, 'quickStoreForm.ejs'), {siteTitle});
    });
    app.post('/quickstore', ensureLogin.ensureLoggedIn('/login'), quickStoreAction);
    app.use('*', ensureLogin.ensureLoggedIn('/login'), proxyHandler);
}
else {
    app.use('*', proxyHandler);
}
app.listen(8080);
