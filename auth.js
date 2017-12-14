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
    app.use('*', ensureLogin.ensureLoggedIn('/login'), proxyHandler);
}
else {
    app.use('*', proxyHandler);
}
app.listen(8080);
