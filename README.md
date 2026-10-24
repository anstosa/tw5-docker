# TiddlyWiki 5 Docker Deployment

> **Archive notice · Historical / unmaintained.** This project is preserved as a record of earlier engineering work. It is not receiving active compatibility or security updates. Instructions and third-party integrations reflect the project's original era; verify them independently before running the code.

## Retrospective

### The problem and product

A containerized TiddlyWiki distribution designed for persistent personal wiki hosting, with a browser-friendly login screen and a quick-store interface for updating tiddlers.

### Engineering approach

The packaging separates wiki data from the disposable container using a mounted volume. It includes authentication components, a fast capture form, and an example backup script, emphasizing the operational details needed for a useful self-hosted tool.

### Takeaways and limitations

The deployment and dependency guidance belongs to the project's original era. Old container images, login handling, and backup scripts must be reviewed before use; the sample deployment should not be mistaken for a security-audited current hosting configuration.

**Related work:** [Markdown](https://github.com/anstosa/tw5-markdown) · [Docker deployment](https://github.com/anstosa/tw5-docker) · [Demo](https://github.com/anstosa/tw5-demo) · [Material theme](https://github.com/anstosa/tw5-material-theme) · [Material companion](https://github.com/anstosa/tw5-material-plugin)

## Original documentation

* [TiddlyWiki5](http://tiddlywiki.com)
* Contained nicely in Docker
* With a user and password manager friendly login page (not HTTP basic auth)
* With a quickstore form for rapidly creating or updating tiddlers on the go without loading all of tiddlywiki

# Requirements

* [Install docker](https://docs.docker.com/engine/installation/linux/docker-ce/ubuntu/)

# Run From Docker Hub

1. `docker run --restart unless-stopped -d -p 8080:8080 -v <path/to/tw5-docker>/data:/var/lib/wiki/data anstosa/tw5-docker`

# Build locally

1. `git clone https://github.com/anstosa/tw5-docker.git`
2. `cd tw5-docker`
3. `docker build -t wiki .`
4. `docker run --restart unless-stopped -d -p 8080:8080 -v <path/to/tw5-docker>/data:/var/lib/wiki/data wiki`

# Configuration

## Data

**NOTE:** make sure to set `path/to/` to the appropriate path where you cloned your repo or your data will not be saved!

If you have an existing TiddlyWiki, copy it into `data/` and renaming it `wiki` (this is hard-coded for now but not user facing)

If you don't have an existing TiddlyWiki a new data tree will be created for you in `data/wiki`

I strongly recommend local and offsite backup for your data. Add the `backup.sh` script to your `/etc/crontab` at to take version snapshots:
```
    0,15,30,45 * * * * <USERNAME> BACKUPS_DIR="</path/to/tw5-docker>/data/backup" </path/to/tw5-docker>/data/backup.sh
```

Use the backup providers of your choice for storing the snapshots in `data/backup/`

## Port

By default the port is `8080`.
You can change this by changing the first port number in the docker run command:
```
    ... -p 4040:8080 ...
```

## Username/Password

If you wish to restrict access to your wiki, pass the `USERNAME` and `PASSWORD` environment variables in your `docker run` command:
```
    ... -e USERNAME="yourname" -e USERNAME="yourpassword" ...
```

## Encryption

This package does not handle encrypting your traffic.
It's recommended that you put your container behind a proxy with an SSL certificate.
