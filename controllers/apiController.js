let bodyParser = require('body-parser');
let mysqlLocal = require('../dbconfig/configLocal').poolLocal;  //  local db
let mysqlCloud = require('../dbconfig/configCloud');  //  cloud db
let mysqlMES = require('../dbconfig/configMES').poolMES;    //  mes data
let Promise = require('bluebird');
let moment = require('moment');
let nodemailer = require('nodemailer');

module.exports = function(app){

    app.use(bodyParser.json({limit: '50mb'}));  //  parse json with limit
    app.use(bodyParser.urlencoded({limit: '50mb', extended: true})); //  handle url request

    app.get('/', function(req, res){
        res.render('index');
    });

    app.post('/404', function(req, res){    // link 404
        let post_gg = req.body; //  change this later
        //console.log(post_gg.gg);
        if(!post_gg.gg){
            console.log('Someone is trying to access the link via post');
            res.send(' Hey, you dont do that to me :) ');
        } else {
            
            function authMailer404(){ //  authenticate the mailer
                return new Promise(function(resolve, reject){
                    // use property poolCloud
                    mysqlCloud.poolCloud.getConnection(function(err, connection){
                        //  query auth
                        connection.query({
                            sql: 'SELECT * FROM tbl_auth_mail '
                        },  function(err, results, fields){
                            let mailer_transporter_obj =[];
                                if(results[0].hasAuth !== 1){
                                    // not authorized
                                    res.send(results[0].user + ' is not authorized');
                                } else {
                                    // authorized from db
                                    mailer_transporter_obj.push({
                                        host: results[0].host,
                                        port:   results[0].port,
                                        user:   results[0].user,
                                        pass:   results[0].pass,
                                        cipher: results[0].cipher
                                    });
                                }
                            resolve(mailer_transporter_obj);
                            console.log('Authenticated mail');
                        });
                        connection.release();
                    });
                });
            }
            
            function adminMail(){ //  admin credentials
                return new Promise(function(resolve, reject){
                    mysqlCloud.poolCloud.getConnection(function(err, connection){
                        connection.query({ //  query admin
                            sql: 'SELECT * FROM tbl_mail_recipients WHERE isAdmin = 1' // admin only
                        },  function(err, results, fields){
                            let mail_admin = [];
                                if(results[0].isAdmin !== 1){
                                    res.send(results[0].email + ' is not admin');
                                } else {
                                    //  clean it
                                    mail_admin.push({
                                        to_mail: results[0].to_mail
                                    });
                                }
                            resolve(mail_admin);
                            console.log('Authenticated admin');
                        });
                        connection.release();
                    });
                });
            }
            
            authMailer404().then(function(mailer_transporter_obj){ //  promise invoker 
                return adminMail().then(function(mail_admin){
                    //  mailer
                    console.log('Sending 404 error to admin...');
                    nodemailer.createTestAccount((err, account) => {
                        //  reusable transporter obj using SMTP
                        let transporter = nodemailer.createTransport({
                            host: mailer_transporter_obj[0].host,
                            port: mailer_transporter_obj[0].port,
                            secure: false,
                            auth: {
                                user: mailer_transporter_obj[0].user,
                                pass: mailer_transporter_obj[0].pass
                            },
                            tls: {
                                ciphers: mailer_transporter_obj[0].cipher
                            }
                        });
                        //  setup mail
                        let mailOptions = {
                            from: '"Auto Mailer" <' + mailer_transporter_obj[0].user + '>', 
                            to: mail_admin[0].to_mail,
                            subject: 'AM Server is OFFLINE.',
                            text: 'Please read the subject ↑',
                        };

                        //  send mail
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                res.send(error);
                                return console.log(error);
                            }
                            console.log('404 error has been sent');
                            res.send('404 error has been sent');
                        });
                    });
                });
            });
        }
    });

    app.post('/202', function(req, res){    //  HTTP OK
        //  auth credentials from post
        let post_auth = req.body;
        //console.log(post_auth.user + ' | ' + post_auth.pass);

        function queryAuth(){ //  function query auth
            return new Promise(function(resolve, reject){
                mysqlCloud.poolCloud.getConnection(function(err, connection){
                    connection.query({
                        sql: 'SELECT * FROM tbl_admin_auth'
                    },  function(err, results, fields){
                        let queryAuth_obj=[];
                            if(typeof results[0].host_name !== 'undefined' || results[0].user !== null || results.length > 0){
                                queryAuth_obj.push({
                                    host_name: results[0].host_name,
                                    user:   results[0].user,
                                    pass:   results[0].pass,
                                    db: results[0].db,
                                    hasAuth:    results[0].hasAuth
                                });
                            } else {
                                reject('Check tbl_admin_auth from mysqlCloud');
                            }
                        resolve(queryAuth_obj);
                    });
                    connection.release();
                });
            });
        }

        queryAuth().then(function(queryAuth_obj){   // invokeroo
            if(typeof post_auth.user == 'undefined' || post_auth.user == null || post_auth.length < 0 || post_auth.user !== queryAuth_obj[0].user || typeof post_auth.pass == 'undefined' || post_auth.pass == null || post_auth.pass !== queryAuth_obj[0].pass ){  //  user & pass from posted value to mysqlcloud not equal
                
                function unauthorized202(){ //  unauthorized IP will be stored to db *ehehehhe*..
                    return new Promise(function(resolve, reject){
                        mysqlCloud.poolCloud.getConnection(function(err, connection){
                            connection.query({
                                sql: 'INSERT INTO tbl_ip SET request_ip=?, access_url=?, access_date=?, access_status=? ',
                                values:[req.ip, '/202', new Date(), 0] // 1 for granted , 0 for denied
                            },  function(err, results, fields){
                                let unauthorized_ip = req.ip;
                                resolve(unauthorized_ip);
                                console.log('Unauthorized access | ' + req.ip + ' | ' + moment(new Date()).format('llll'));
                            });
                            connection.release();
                        });
                    });
                }
    
                unauthorized202().then(function(unauthorized_ip){   // invoket
                    res.send(' Unauthorized access by ' + unauthorized_ip); 
                });
    
            } else if(post_auth.user === queryAuth_obj[0].user && post_auth.pass === queryAuth_obj[0].pass) {   // same user & pass
    
                function authorized202(){  // authorized IP will be stored too :P
                    return new Promise(function(resolve, reject){
                        mysqlCloud.poolCloud.getConnection(function(err, connection){
                            connection.query({
                                sql: 'INSERT INTO tbl_ip SET request_ip=?, access_url=?, access_date=?, access_status=?',
                                values: [req.ip, '/202', new Date(), 1] // granted
                            },  function(err, results, fields){
                                let authorized_ip = req.ip;
                                resolve(authorized_ip);
                                console.log('Access Granted | ' + req.ip + ' | ' + moment(new Date()).format('llll'));
                            });
                            connection.release();
                        });
                    });
                }
    
                function authMailer202(){   //  authenticate the mailer
                    return new Promise(function(resolve, reject){ // use property poolCloud
                        mysqlCloud.poolCloud.getConnection(function(err, connection){ //  query auth
                            connection.query({
                                sql: 'SELECT * FROM tbl_auth_mail '
                            },  function(err, results, fields){
                                let mailer_transporter_obj =[];
                                    if(results[0].hasAuth !== 1){
                                        res.send(results[0].user + ' is not authorized'); // not authorized
                                    } else {
                                        // authorized from db
                                        mailer_transporter_obj.push({
                                            host: results[0].host,
                                            port:   results[0].port,
                                            user:   results[0].user,
                                            pass:   results[0].pass,
                                            cipher: results[0].cipher
                                        });
                                    }
                                resolve(mailer_transporter_obj);
                                console.log('Authenticated mail');
                            });
                            connection.release();
                        });
                    });
                }
    
                //  wip and outs recipients 
                function recipientMail(){
                    return new Promise(function(resolve, reject){
                        mysqlCloud.poolCloud.getConnection(function(err, connection){
                            connection.query({
                                sql: 'SELECT DISTINCT(to_mail) FROM tbl_mail_recipients WHERE isAdmin = 0' // 0 for regular recipients wip and outs
                            },  function(err, results, fields){
                                let recipients_arr = [];
                                    for(let i=0;i<results.length;i++){
                                        recipients_arr.push(
                                           results[i].to_mail
                                        );
                                    }
                                resolve(recipients_arr);
                                console.log('recipients loaded');
                            });
                            connection.release();
                        });
                    });
                }
    
                function wipReport(){ //  3 previous shift WIP summary 
                    return new Promise(function(resolve, reject){
                        mysqlMES.poolMES.getConnection(function(err, connection){   // using MES credentials
                            connection.query({
                                sql: '',
                            },  function(err, results, fields){
    
                            });
                            connection.release();
                        });
                    });
                }
    
                function outsReport(){  //  3 previous shift OUTS summary
                    return new Promise(function(resolve, reject){
                        mysqlMES.poolMES.getConnection(function(err, connection){   
                            connection.query({
                                sql: '',
                            },  function(err, results, fields){
    
                            });
                            connection.release();
                        });
                    });
                }
    
                authorized202().then(function(authorized_ip){ // invoker for all the objects :)
                    return authMailer202().then(function(mailer_transporter_obj){
                        return recipientMail().then(function(recipients_arr){
                            //  mailer
                            nodemailer.createTestAccount((err, account) => {
                                console.log('Sending from nodemailer....');
                                //  reusable transporter obj using SMTP
                                let transporter = nodemailer.createTransport({
                                    host: mailer_transporter_obj[0].host,
                                    port: mailer_transporter_obj[0].port,
                                    secure: false, // we're standard tls
                                    auth: {
                                        user: mailer_transporter_obj[0].user,
                                        pass: mailer_transporter_obj[0].pass
                                    },
                                    tls: {
                                        ciphers: mailer_transporter_obj[0].cipher
                                    }
                                });
        
                                //  array to string 
                                let recipientToString = recipients_arr.join(", "); // join with comma
        
                                //  setup mail
                                let mailOptions = {
                                    from: '"Auto Mailer" <' + mailer_transporter_obj[0].user + '>', 
                                    to: recipientToString,
                                    subject: 'WIP & Outs Report (Testing) ' + moment(new Date()).format('llll'),
                                    text: 'This email is from nodejs program - kevin',
                                };
        
                                //  send mail
                                transporter.sendMail(mailOptions, (error, info) => {
                                    if (error) {
                                        return console.log(error);
                                    }
                                    console.log('Message sent!');
                                    res.send('Requested by: ' + authorized_ip + ' Report sent successfully!');
                                });
                            });
                        });
                    });    
                });
            }
        });
    });
} 