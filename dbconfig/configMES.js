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

function authMES(){
    return new Promise(function(resolve, reject){
        connectAuth.getConnection(function(err, connection){
            connection.query({
                sql: 'SELECT * FROM tbl_mes_details'
            },  function(err, results, fields){
                    let auth_mes_obj=[];
                    if(results[0].hasAuth == 1){ // only 1 user has 1 auth
                        auth_mes_obj.push({
                            auth_host: results[0].host_name,
                            auth_user:  results[0].user,
                            auth_password:  results[0].pass,
                            auth_database:  results[0].db
                        });
                    }
                resolve(auth_mes_obj);
            });
            connection.release();
        });
    });
}

authMES().then(function(auth_mes_obj){
    let poolMES = mysql.createPool({
        multipleStatements: true,
        connectionLimit: 1000,
        host:   auth_mes_obj[0].auth_host,
        user:   auth_mes_obj[0].auth_user,
        password:   auth_mes_obj[0].auth_password,
        database:   auth_mes_obj[0].auth_database
    });
    exports.poolMES = poolMES;
});
