let express = require('express');
let app = express();

let cookieSession = require('cookie-session');
let apiController = require('./controllers/apiController');

let port = process.env.PORT || 8000;

//  use static folder
app.use('/', express.static(__dirname + '/public'));
//  set template engine
app.set('view engine', 'ejs');

//  session
app.set('trust proxy', 1) // trust first proxy
app.use(cookieSession({
 name: 'session',
 keys: ['key1', 'key2']
}));

apiController(app);

app.listen(port);