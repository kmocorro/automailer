let bodyParser = require('body-parser');
let mysqlLocal = require('../dbconfig/configLocal');  //  local db
let mysqlCloud = require('../dbconfig/configCloud');  //  cloud db
let mysqlMES = require('../dbconfig/configMES');    //  mes data
let Promise = require('bluebird');
let moment = require('moment');
let nodemailer = require('nodemailer');

module.exports = function(app){

    app.use(bodyParser.json({limit: '50mb'}));  //  parse json with limit
    app.use(bodyParser.urlencoded({limit: '50mb', extended: true})); //  handle url request

    app.get('/', function(req, res){
        res.render('index', {ip: req.ip});
    });

    app.post('/404', function(req, res){    // link 404
        let post_gg = req.body; //  change this later
        //console.log(post_gg.gg);
        if(!post_gg.gg){
            console.log('Someone is trying to access the link via post IP: ' + req.ip + ' as of ' + moment(new Date()).format('llll'));
            res.send(' Hey, ' + req.ip + ' you dont do that to me. Dont worry, I will get back to you. :) ');
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
                            subject: 'AM Error 404 | Index has been changed!',
                            text: 'Check automailer.sh if the link was not http://localhost:8000/',
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
    
                function outsReportAM(){  // AM extractor// 3 previous shift OUTS summary
                    return new Promise(function(resolve, reject){
                        mysqlMES.poolMES.getConnection(function(err, connection){   
                            connection.query({
                                sql: 'SELECT A.process_id, A.first_d, B.second_d, C.third_d FROM (SELECT process_id, SUM(out_qty) AS first_d FROM MES_OUT_DETAILS A	WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 18:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL 0 DAY)," 06:29:59")  GROUP BY process_id) A JOIN(SELECT process_id, SUM(out_qty) AS second_d FROM MES_OUT_DETAILS A WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 06:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 18:29:59") GROUP BY process_id) B ON A.process_id = B.process_id JOIN(SELECT process_id, SUM(out_qty) AS third_d FROM MES_OUT_DETAILS A WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL -2 DAY)," 18:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 06:29:59") GROUP BY process_id)  C ON A.process_id = C.process_id '
                            },  function(err, results, fields){
                                    let outsReports_obj = [];
                                        for(let i=0;i<results.length;i++){
                                            outsReports_obj.push({
                                                process_id: results[i].process_id,
                                                first_d: results[i].first_d,
                                                second_d: results[i].second_d,
                                                third_d: results[i].third_d
                                            });
                                        }
                                    resolve(outsReports_obj);
                            });
                            connection.release();
                        });
                    });
                }

                function outsReportPM(){
                    return new Promise(function(resolve, reject){
                        mysqlMES.poolMES.getConnection(function(err, connection){
                            connection.query({
                                sql: 'SELECT A.process_id, A.first_d, B.second_d, C.third_d FROM     (SELECT process_id, SUM(out_qty) AS first_d FROM MES_OUT_DETAILS A    WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL 0 DAY)," 06:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL 0 DAY)," 18:29:59")    GROUP BY process_id) A    JOIN(SELECT process_id, SUM(out_qty) AS second_d FROM MES_OUT_DETAILS A    WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 18:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL 0 DAY)," 06:29:59")    GROUP BY process_id) B  ON A.process_id = B.process_id    JOIN(SELECT process_id, SUM(out_qty) AS third_d FROM MES_OUT_DETAILS A     WHERE date_time >= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 06:30:00") AND date_time <= CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 18:29:59")    GROUP BY process_id)  C   ON A.process_id = C.process_id'
                            },  function(err, results, fields){
                                    let outsReportPM_obj = [];
                                        for(let i=0;i<results.length;i++){
                                            outsReportPM_obj.push({
                                                process_id: results[i].process_id,
                                                first_d: results[i].first_d,
                                                second_d: results[i].second_d,
                                                third_d: results[i].third_d
                                            });
                                        }
                                    resolve(outsReportPM_obj);
                            });
                            connection.release();
                        });
                    });
                }


                authorized202().then(function(authorized_ip){ // invoker number 2
                    return authMailer202().then(function(mailer_transporter_obj){
                        return recipientMail().then(function(recipients_arr){

                            let currentTime = new Date();
                            let isAMorPM = moment(currentTime).format('A');
                            
                            if(isAMorPM == 'AM'){ // clean obj for AM Extract only
                                console.log('Running on AM shift');
                                // check if AM outs exist to avoid multiple staging
                                mysqlCloud.poolCloud.getConnection(function(err, connection){
                                    connection.query({
                                        sql: 'SELECT * FROM tbl_outs_data WHERE first_d = CONCAT(DATE_ADD(CURDATE(), INTERVAL -1 DAY)," 18:30:00") AND upload_date >= CONCAT(CURDATE()," 06:30:00")'
                                    },  function(err, results, fields){

                                        if(typeof results[0] == 'undefined' || results[0] == null || results.length < 0){ // if not exist
                                            // 2018-01-02 | extract from cloud to excel then attach to nodemailer
                                            return outsReportAM().then(function(outsReports_obj){

                                                let outsReports_obj_cleaned = [];
                                                let DATEgo = moment(new Date()).subtract(1, 'days');
                                                let first_d = moment(DATEgo).format('YYYY-MM-DD [18:30:00]');
                                                let second_d = moment(DATEgo).format('YYYY-MM-DD [06:30:00]');
                                            
                                                let DATEgogo = moment(new Date()).subtract(2, 'days');
                                                let third_d = moment(DATEgogo).format('YYYY-MM-DD [18:30:00]');
                                                
                                                for(let i=0;i<outsReports_obj.length;i++){ // cleaning object
                                                        if(outsReports_obj[i].process_id == 'DAMAGE'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'POLY'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'BSGDEP'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'NTM'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'NOXE'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'NDEP'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'PTM'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'TOXE'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'CLEANTEX'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'PDRIVE'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'ARC_BARC'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'PBA'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'LCM'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'SEED'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'FGA'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'PLM'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'EDG_CTR'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'PLATING'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'ETCHBK'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                                });
                                                            } else if(outsReports_obj[i].process_id == 'TEST'){
                                                                outsReports_obj_cleaned.push({ 
                                                                    process_id: outsReports_obj[i].process_id,
                                                                    first_d: first_d,
                                                                    first_d_Outs: outsReports_obj[i].first_d,
                                                                    second_d: second_d,
                                                                    second_d_Outs: outsReports_obj[i].second_d,
                                                                    third_d: third_d,
                                                                    third_d_Outs: outsReports_obj[i].third_d
                                                            });
                                                        }
                                                }
                                                    
                                                mysqlCloud.poolCloud.getConnection(function(err, connection){ // cleaned obj to cloud 
                                                    console.log('Uploading to db...');
                                                    for(let i=0;i<outsReports_obj_cleaned.length;i++){
                                                        connection.query({
                                                            sql: 'INSERT INTO tbl_outs_data SET upload_date=?, process_id=?, first_d=?, first_d_Outs=?, second_d=?, second_d_Outs=?, third_d=?, third_d_Outs=?',
                                                            values: [new Date(), outsReports_obj_cleaned[i].process_id, outsReports_obj_cleaned[i].first_d, outsReports_obj_cleaned[i].first_d_Outs, outsReports_obj_cleaned[i].second_d, outsReports_obj_cleaned[i].second_d_Outs, outsReports_obj_cleaned[i].third_d, outsReports_obj_cleaned[i].third_d_Outs]
                                                        },  function(err, results, fields){
                                                        });
                                                    }
                                                    connection.release();
                                                    console.log('AM | Saved to cloud');
                                                });
            
                                                nodemailer.createTestAccount((err, account) => { //  mail man :O 
                                                    console.log('Sending from nodemailer....');
                                                    
                                                    let transporter = nodemailer.createTransport({ //  reusable transporter obj using SMTP
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
                                        } else {
                                            console.log('AM data already exists');
                                            // send email
                                            nodemailer.createTestAccount((err, account) => { //  mail man :O 
                                                console.log('Sending from nodemailer....');
                                                
                                                let transporter = nodemailer.createTransport({ //  reusable transporter obj using SMTP
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
                                        }
                                    });
                                    connection.release();
                                });

                            } else if(isAMorPM == 'PM'){ // clean obj for PM Extract only  
                                console.log('Running on PM shift');   
                                // check if PM outs exist to avoid multiple staging
                                mysqlCloud.poolCloud.getConnection(function(err, connection){
                                    connection.query({
                                        sql: 'SELECT * FROM tbl_outs_data WHERE first_d = CONCAT(CURDATE()," 06:30:00") AND upload_date >= CONCAT(CURDATE()," 18:30:00")'
                                    },  function(err, results, fields){

                                        if(typeof results[0] == 'undefined' || results[0] == null || results.length < 0){
                                            return outsReportPM().then(function(outsReportPM_obj){  
                                                let outsReportPM_obj_cleaned = [];
                                                let first_d = moment(new Date()).format('YYYY-MM-DD [06:30:00]');
                                                
                                                let DATEpm = moment(new Date()).subtract(1, 'days');
                                                let second_d = moment(DATEpm).format('YYYY-MM-DD [18:30:00]');
                                                let third_d = moment(DATEpm).format('YYYY-MM-DD [06:30:00]');
                                        
                                                for(let i=0;i<outsReportPM_obj.length;i++){ // pm cleaners
                                                        if(outsReportPM_obj[i].process_id == 'DAMAGE'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'POLY'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'BSGDEP'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'NTM'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'NOXE'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'NDEP'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'PTM'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'TOXE'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'CLEANTEX'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'PDRIVE'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'ARC_BARC'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'PBA'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'LCM'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'SEED'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'FGA'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'PLM'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'EDG_CTR'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'PLATING'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'ETCHBK'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        } else if(outsReportPM_obj[i].process_id == 'TEST'){
                                                            outsReportPM_obj_cleaned.push({ 
                                                                process_id: outsReportPM_obj[i].process_id,
                                                                first_d: first_d,
                                                                first_d_Outs: outsReportPM_obj[i].first_d,
                                                                second_d: second_d,
                                                                second_d_Outs: outsReportPM_obj[i].second_d,
                                                                third_d: third_d,
                                                                third_d_Outs: outsReportPM_obj[i].third_d
                                                            });
                                                        }
                                                }
            
                                                mysqlCloud.poolCloud.getConnection(function(err, connection){ // cleaned pm obj are now going to sleep
                                                    console.log('Uploading to db...');
                                                        for(let i=0;i<outsReportPM_obj_cleaned.length;i++){
                                                            connection.query({
                                                                sql:'INSERT INTO tbl_outs_data SET upload_date=?, process_id=?, first_d=?, first_d_Outs=?, second_d=?, second_d_Outs=?, third_d=?, third_d_Outs=?',
                                                                values:[new Date(), outsReportPM_obj_cleaned[i].process_id, outsReportPM_obj_cleaned[i].first_d, outsReportPM_obj_cleaned[i].first_d_Outs, outsReportPM_obj_cleaned[i].second_d, outsReportPM_obj_cleaned[i].second_d_Outs, outsReportPM_obj_cleaned[i].third_d, outsReportPM_obj_cleaned[i].third_d_Outs]
                                                            }, function(err, results, fields){
                                                            });
                                                        }
                                                        connection.release();
                                                        console.log('PM SHIFT done');
                                                        // done pm
                                                });
            
                                                nodemailer.createTestAccount((err, account) => { //  mail man :O 
                                                        console.log('Sending from nodemailer....');
                                                         
                                                        let transporter = nodemailer.createTransport({ //  reusable transporter obj using SMTP
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
                                        } else {
                                            console.log('PM data already exists');

                                            // send email
                                            nodemailer.createTestAccount((err, account) => { //  mail man :O 
                                                console.log('Sending from nodemailer....');
                                                
                                                let transporter = nodemailer.createTransport({ //  reusable transporter obj using SMTP
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

                                        }

                                    });
                                    connection.release();
                                });

                            }

                        });
                    });
                });

            }
        });
    });
} 