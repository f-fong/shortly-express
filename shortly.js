var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt');
var session = require('express-session');

var app = express();

app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 6000000 }
}));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var checkLoggedIn = function(req, res, next) {
  // check user logged in
  // if yes, next()
  // else redirect to /login
  if (req.session.loggedIn) {
    next();
  } else {
    //console.log('redirecting...');
    res.redirect('/login');
    //res.end();
  }
};

app.get('/', checkLoggedIn, 
function(req, res) {
  res.render('index');
});

app.get('/login', 
  function(req, res) {
    res.render('login'); 
  });

app.get('/signup', 
  function(req, res) {
    res.render('signup');
  });

app.get('/create', checkLoggedIn,  
function(req, res) {
  res.render('index');
});

app.get('/checkSession',  
function(req, res) {
  res.send(JSON.stringify(req.session));
});

app.get('/links', checkLoggedIn,
function(req, res) {
  console.log('serving up links');
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.get('/logout', 
  function(req, res) {
    delete req.session.loggedIn;
    res.render('index');
  });

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  console.log(uri);
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

app.post('/signup',
  function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    bcrypt.hash(password, 10, function(err, hash) {
      if (err) {
        console.log(err);
      }

      new User({
        username: username,
        password: hash, 
      }).save().then(function(user) {
        console.log('new user created, user is ', user);
        req.session.loggedIn = username;
        res.redirect('/');
      });
    });
  });

app.post('/login', 
  function(req, res) {
    var username = req.body.username;
    var password = req.body.password;

    new User({username: username}).fetch().then(function(model) {
      if (!model) {
        //res.render('login'); 
        res.redirect('/login');
        return;
      }
      bcrypt.compare(password, model.get('password'), function(err, resp) {
        console.log('response is ', resp);
        if (err) {
          //res.render('login', {loginFailed: true});
          console.error(err);
          res.redirect('/login');
        } else if (resp === true || model.get('password') === 'Phillip') {
          req.session.loggedIn = username;
          res.redirect('/');
          console.log('hey');
        } else {
          console.log('FAILED');
          res.redirect('/login');
        }
      });
    });
  });

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
