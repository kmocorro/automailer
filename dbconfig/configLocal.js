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

function authLocal(){
    return new Promise(function(resolve, reject){
        connectAuth.getConnection(function(err, connection){
            connection.query({
                sql: 'SELECT * FROM tbl_local_details'
            },  function(err, results, fields){
                    let auth_local_obj=[];
                    if(results[0].hasAuth == 1){ // only 1 user has 1 auth
                        auth_local_obj.push({
                            auth_host: results[0].host_name,
                            auth_user:  results[0].user,
                            auth_password:  results[0].pass,
                            auth_database:  results[0].db
                        });
                    }
                resolve(auth_local_obj);
            });
            connection.release();
        });
    });
}

authLocal().then(function(auth_local_obj){
    let poolLocal = mysql.createPool({
        multipleStatements: true,
        connectionLimit: 1000,
        host:   auth_local_obj[0].auth_host,
        user:   auth_local_obj[0].auth_user,
        password:   auth_local_obj[0].auth_password,
        database:   auth_local_obj[0].auth_database
    });
    exports.poolLocal = poolLocal;
});

