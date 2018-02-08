# OpenCCTVdragon

In a nutshell; this was a fun experiment to 'spy' on users with WebSockets and [OpenSeadragon](https://github.com/openseadragon/openseadragon/). You can read more about the project in the [blog post I wrote](https://blog.cogapp.com/), or try a live demonstration on [http://opencctvdragon.cogapp.com/](http://opencctvdragon.cogapp.com/)

```
                  +-------------------+
           +----->+  Screens [1 - 9]  +-------+
           |      +-------------------+       |
  Occupy   |                                  |   Viewed by
           |                                  |
           |                                  |
           |                                  v
 +---------+----------+             +---------+---------+
 |                    |             |                   |
 |                    |             |                   |
 |      Cameras       |             |  Control Room(s)  |
 |                    |             |                   |
 |                    |             |                   |
 +---------+----------+             +---------+---------+
           ^                                  |
           |                                  |
   Data    |                                  |   Data
           |                                  v
+----------+----------------------------------+----------+
|                                                        |
|                                                        |
|                    WebSocket Server                    |
|                                                        |
|                                                        |
+---+---+---+--------------------------------+---+---+---+
    ^   ^   ^                                |   |   |
    |   |   |                                |   |   |
    |   |   |                                |   |   |
    |   |   |                                |   |   |
    |   |   |                                v   v   v
+---+---+---+---+                        +---+---+---+---+
|               |                        |               |
|    Clients    |                        |    Clients    |
|               |                        |               |
+---------------+                        +---------------+
```

## Running this project locally

This was developed with [node 8.x](https://nodejs.org/en/) in mind.

- Clone the repo
- `npm install`
- `npm start`
- Go to `http://localhost:3000`

## Running this project on a remote server

There are numerous ways of accomplishing this, but in my case the specific environment I had was already running apache. If you don't want to use apache you should be able to get similar results with iptables and/or nginx. For the configuration described in this README however, you will need:

- node (8.x)
- pm2
- apache2

### Reverse proxy in apache

This assumes there will be a separate virtualhost; that's probably the easiest way to do this because you can just proxy everything. There are other ways... but they require more effort 🌝

Ensure the following apache modules are enabled with `a2enmod <module> <module> ...`

- `headers`
- `proxy`
- `proxy_http`
- `proxy_wstunnel`

The virtualhost needs to be configured to:

- Proxy requests to the node app
- Rewrite headers so everything looks legit

Based on the above here is a sample config:

```
  ServerName "http://opencctvdragon.cogapp.com"
  Header edit Origin http://opencctvdragon.cogapp.com localhost:3000
  RequestHeader edit Origin http://opencctvdragon.cogapp.com localhost:3000
  Header edit Referer http://opencctvdragon.cogapp.com localhost:3000
  RequestHeader edit Referer http://opencctvdragon.cogapp.com localhost:3000

  ProxyPass /ws/control-room ws://localhost:3000/ws/control-room
  ProxyPassReverse /ws/control-room ws://localhost:3000/ws/control-room
  ProxyPass /ws/viewer ws://localhost:3000/ws/viewer
  ProxyPassReverse /ws/viewer ws://localhost:3000/ws/viewer
  ProxyPass / http://localhost:3000/
  ProxyPassReverse / http://localhost:3000/
```

N.B. The order of proxypass rules here is important, generally you'll want the longest to be declared first as the first match will be taken with subsequent rules ignored.