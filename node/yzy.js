var Nightmare = require('nightmare');
var _ = require('lodash');
var request = require('request');
var config = require('./config');
var wait = require('nightmare-wait-for-url');
var chalk = require('chalk');
var util = require('util');

function cookieFormat(cookies) {
  var updated = [];
  _.each(cookies, function(cookie) {
    var url = '';
    if(cookie.secure) {
      url += 'https://';
    } else {
      url += 'http://';
    }
    if(cookie.domain.startsWith('.')) {
      url += 'www';
    }
    url += cookie.domain;
    updated.push(_.assign({url: url}, _.omit(cookie, 'domain')))
  });
  return updated;
}

Nightmare.action('show',
  function(name, options, parent, win, renderer, done) {
    parent.respondTo('show', function(done) {
      win.show();
      done();
    });
    done();
  },
  function(done) {
    this.child.call('show', done);
  });

Nightmare.action('hide',
  function(name, options, parent, win, renderer, done) {
    parent.respondTo('hide', function(done) {
      win.hide();
      done();
    });
    done();
  },
  function(done) {
    this.child.call('hide', done);
  });

Nightmare.action('clearCache',
  function(name, options, parent, win, renderer, done) {
    parent.respondTo('clearCache', function(done) {
      win.webContents.session.clearCache(done);
      done();
    });
    done();
  },
  function(done) {
    this.child.call('clearCache', done);
  });

Nightmare.action('printUserAgent',
  function(name, options, parent, win, renderer, done) {
    parent.respondTo('printUserAgent', function(done) {
      done(null, win.webContents.getUserAgent());
    });
    done();
  },
  function(done) {
    this.child.call('printUserAgent', done);
  });

function postPageSource(src) {
  request.post({
    url: 'https://snippets.glot.io/snippets',
        json: true,
        headers: {
          'Authorization': 'Token ff5b3c9f-4582-4200-a88c-dc260d8ee453'
        },
        body: {
          'language': 'plaintext',
          'title': config.splashUrl,
          'public': true,
          'files': [{'name': 'productpage.html', 'content': src}]
        }
      })
    }

var instanceArray = new Array(config.partySize);
_.each(instanceArray, function(browser, i) {
  instanceArray[i] = Nightmare({
    show: true,
    alwaysOnTop: true,
    webPreferences: {
      partition: i
    }
  }).useragent(config.userAgent)
      .cookies.clearAll()
      .clearCache()
      .cookies.set(cookieFormat(config.gmailCookies));
    setTimeout(function() {
                                                                    console.log("DEBUG POINT 1"); //RUNS UP UNTIL THIS POINT
      instanceArray[i]
        .goto(config.splashUrl)
        .then(function() {
          party(instanceArray[i], i);
          //postPageSource(html);
                                                                    console.log("DEBUG POINT 2"); //NOT BEING RUN?
        }).catch(function(error) {
          console.error('Error! ' + error + '.');
          console.error(util.inspect(error));
          instanceArray[i].end();
        });
    }, 1000 * i);
});

function killSwitch(nm) {
  _.each(instanceArray, function(browser) {
    if(browser !== nm) {
      browser.end();
    }
  });
}

function party(nm, i) {
  nm.exists(config.splashUniqueIdentifier)
    .then(function(isSplash) {
      if(isSplash) {
        return nm.html(`./page-source/${new Date().toString()}.html`, "HTMLComplete")
          .then(function() {
            return nm.cookies.get({url: null})
              .then(function(cookies) {
                console.log(chalk.green('********************************'));
                console.log(chalk.green('Passed splash on Instance #' + (i + 1) + '!'));
                console.log(chalk.green('********************************'));
                console.log(chalk.green('Cookie Output:'));
                console.log(chalk.green('********************************'));
                console.log(chalk.green(JSON.stringify(cookies)));
                console.log(chalk.green('********************************'));
                console.log(chalk.green('Suspected HMAC Cookie(s):'));
                console.log(chalk.green('********************************'));
                console.log(chalk.green(JSON.stringify(_.filter(cookies, function(cookie) {
                  return _.includes(cookie.value, 'hmac');
                }))));
                console.log(chalk.green('********************************'));
              }).then(function() {
                return nm.elevate(function() {
                  var action = document.querySelector('#flashproductform');
                  if(action) {
                    action = action.getAttribute('action');
                    return action.substr(action.indexOf('clientId=') + 9, action.length);
                  } else {
                    return ''
                  }
                });
              }).then(function(clientid) {
                console.log(chalk.green('Client ID:'));
                console.log(chalk.green('********************************'));
                console.log(chalk.green(clientid));
                console.log(chalk.green('********************************'));
              }).then(function() {
                return nm.evaluate(function() {
                  if(window.captchaResponse) {
                    return window.captchaResponse.toString();
                  } else {
                    return '';
                  }
                });
              }).then(function() {
                return nm.evaluate(function() {
                  var sitekey = document.querySelector('[data-sitekey]');
                  if(sitekey) {
                    return sitekey.getAttribute('data-sitekey');
                  } else {
                    return '';
                  }
                });
              }).then(function(sitekey) {
                console.log(chalk.green('Sitekey:'));
                console.log(chalk.green('********************************'));
                console.log(chalk.green(sitekey));
                console.log(chalk.green('********************************'));
              }).then(function() {
                if(config.hmacOnly) {
                  nm.end();
                } else {
                  return nm.show();
                }
              }).then(function() {
                if(!uploadedSource && config.enableSourceUpload) {
                  uploadedSource = true;
                  return nm.evaluate(function() {
                    return document.querySelector('html').outerHTML;
                  }).then(function(html) {
                    postPageSource(html);
                  }).catch(function(error) {
                    console.error('Error! ' + error + '.');
                    console.error(util.inspect(error));
                    nm.end();
                  });
                } else {
                  return nm
                    .wait(config.waitTime)
                    .then(function() {
                      return nm.cookies.clearAll()
                    })
                    .then(function() {
                      return nm.clearCache()
                    })
                    .then(function() {
                      return nm.refresh();
                    })
                    .then(function() {
                      party(nm, i);
                    }).catch(function(error) {
                      console.error('Error! ' + error + '.');
                      console.error(util.inspect(error));
                      nm.end();
                    });
                }
              }).catch(function(error) {
                console.error('Error! ' + error + '.');
                nm.end();
              });
          })
      }
    })
}
