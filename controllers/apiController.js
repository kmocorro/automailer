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

    app.post('/gg', function(req, res){
        // mailer service
        let post_gg = req.body;
        console.log(post_gg.gg);

        if(!post_gg.gg){

            console.log('Someone is trying to access the link via post');
            res.send(' Hey, you dont do that to me :) ');

        } else {
            
            function authMailer(){
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
                    });
                });
            }

            function adminMail(){
                return new Promise(function(resolve, reject){
                    mysqlCloud.poolCloud.getConnection(function(err, connection){
                        //  query admin
                        connection.query({
                            sql: 'SELECT * FROM tbl_mail_recipients '
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

            authMailer().then(function(mailer_transporter_obj){
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

} 