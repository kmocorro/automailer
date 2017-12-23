let bodyParser = require('body-parser');
let mysqlLocal = require('../dbconfig/configLocal').poolLocal;  //  local db
let mysqlCloud = require('../dbconfig/configCloud');  //  cloud db
let mysqlMES = require('../dbconfig/configMES').poolMES;    //  mes data
let Promise = require('bluebird');
let moment = require('moment');
let nodemailer = require('nodemailer');

module.exports = function(app){

    //  parse json with limit
    app.use(bodyParser.json({limit: '50mb'}));
    //  handle url request
    app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

    app.post('/404', function(req, res){    // link 404
        //  change this later
        let post_gg = req.body;
        console.log(post_gg.gg);

        if(!post_gg.gg){

            console.log('Someone is trying to access the link via post');
            res.send(' Hey, you dont do that to me :) ');

        } else {
            //  authenticate the mailer
            function authMailer404(){
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
                        });
                        connection.release();
                    });
                });
            }
            //  admin credentials
            function adminMail(){
                return new Promise(function(resolve, reject){
                    mysqlCloud.poolCloud.getConnection(function(err, connection){
                        //  query admin
                        connection.query({
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
                        });
                        connection.release();
                    });
                });
            }
            //  promise invoker 
            authMailer404().then(function(mailer_transporter_obj){
                return adminMail().then(function(mail_admin){
                    //  mailer
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
                            text: 'Please check our server: http://10.3.95.227:8000/mailer',
                        };

                        //  send mail
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                return console.log(error);
                            }
                            console.log('Message sent!');
                            res.send('DONE!');
                        });
                    });
                });
            });
        }
    });

    app.post('/202', function(req, res){    //  HTTP OK
        //  auth credentials from post
        let post_auth = req.body;
        console.log(post_auth.user + ' | ' + post_auth.pass);

        //  function query auth
        function queryAuth(){
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
                            }
                        resolve(queryAuth_obj);
                    });
                    connection.release();
                });
            });
        }

        queryAuth().then(function(queryAuth_obj){
            if(typeof post_auth.user == 'undefined' || post_auth.user == null || post_auth.length < 0 || post_auth.user !== queryAuth_obj[0].user || typeof post_auth.pass == 'undefined' || post_auth.pass == null || post_auth.pass !== queryAuth_obj[0].pass ){
                console.log('Unauthorized access | ' + req.ip + ' | ' + moment(new Date()).format()); // remove this in prod
                
                function unauthorized202(){
                    return new Promise(function(resolve, reject){
                        //  unauthorized IP will be stored to db *ehehehhe*..
                        mysqlCloud.poolCloud.getConnection(function(err, connection){
                            connection.query({
                                sql: 'INSERT INTO tbl_ip SET request_ip=?, access_url=?, access_date=?, access_status=? ',
                                values:[req.ip, '/202', new Date(), 0] // 1 for granted , 0 for denied
                            },  function(err, results, fields){
                                let unauthorized_ip = req.ip;
                                resolve(unauthorized_ip);
                                console.log('Denied');
                            });
                            connection.release();
                        });
                    });
                }
    
                unauthorized202().then(function(unauthorized_ip){
                    res.send(' Unauthorized access by ' + unauthorized_ip); 
                });
    
            } else if(post_auth.user === queryAuth_obj[0].user && post_auth.pass === queryAuth_obj[0].pass) {
                console.log('Access Granted | ' + req.ip + ' | ' + moment(new Date()).format()); // remove this in prod
    
                function authorized202(){
                    return new Promise(function(resolve, reject){
                        // authorized IP will be stored :P
                        mysqlCloud.poolCloud.getConnection(function(err, connection){
                            connection.query({
                                sql: 'INSERT INTO tbl_ip SET request_ip=?, access_url=?, access_date=?, access_status=?',
                                values: [req.ip, '/202', new Date(), 1] // granted
                            },  function(err, results, fields){
                                let authorized_ip = req.ip;
                                resolve(authorized_ip);
                                console.log('Granted');
                            });
                            connection.release();
                        });
                    });
                }
    
                //  authenticate the mailer
                function authMailer202(){
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
    
                //  3 previous shift WIP summary 
                function wipReport(){
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
    
                //  3 previous shift OUTS summary
                function outsReport(){
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
    
                authorized202().then(function(authorized_ip){
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
                                    res.send('Request by: ' + authorized_ip + ' report sent successfully');
                                });
                            });
                        });
                    });    
                });
            }
        });
        
    });

} 