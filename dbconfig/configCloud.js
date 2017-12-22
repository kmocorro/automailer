let mysql = require('mysql');
let Promise = require('bluebird');

let connectAuth = mysql.createPool({
    multipleStatements: true,
    connectionLimit: 1000,
    host:   'localhost',
    user:   'root',
    password:   '2qhls34r',
    database:   'dbauth'
});

function authCloud(){
    return new Promise(function(resolve, reject){
        connectAuth.getConnection(function(err, connection){
            connection.query({
                sql: 'SELECT * FROM tbl_cloud_details'
            },  function(err, results, fields){
                    let auth_cloud_obj=[];
                    if(results[0].hasAuth == 1){ // only 1 user has 1 auth
                        auth_cloud_obj.push({
                            auth_host: results[0].host_name,
                            auth_user:  results[0].user,
                            auth_password:  results[0].pass,
                            auth_database:  results[0].db
                        });
                    }
                resolve(auth_cloud_obj);
            });
            connection.release();
        });
    });
}

authCloud().then(function(auth_cloud_obj){
    let poolCloud = mysql.createPool({
        multipleStatements: true,
        connectionLimit: 1000,
        host:   auth_cloud_obj[0].auth_host,
        user:   auth_cloud_obj[0].auth_user,
        password:   auth_cloud_obj[0].auth_password,
        database:   auth_cloud_obj[0].auth_database
    });
    exports.poolCloud = poolCloud;
});

