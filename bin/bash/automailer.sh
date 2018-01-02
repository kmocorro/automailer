# !/bin/bash
# Automailer
# Xtranghero
# VERSION 1.0
# 2017-12-21

# Checker every 06:33 and 18:33

# varbs
PATH=$PATH:/c/xampp/mysql/bin
APIRES=$(wget --server-response http://localhost:8000/ -O /c/sandbox/nodejs-automailer/public/reslog.txt 2>&1 | grep -c 'HTTP/1.1 200 OK') #check if automailer is online
HOST="localhost"
USER="root"
PASS="2qhls34r"
DB="dbauth"
POSTU=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT user FROM tbl_cloud_details;")
POSTP=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT pass FROM tbl_cloud_details;")

conRefused(){ # is connection refused? || is nodejs server down?
                        
    echo "Connection refused means server is down..."
    rm ../tmp/automailer.txt

    start ../reviver/noderev.sh
    echo "Running Node Reviver..."
    sleep 15 # wait for noderev to initialize
                        
    sh ./automailer.sh # rinse and repeat
    exit

}

echo "Checking DB conenction..."
if [ ! $POSTU ]; then
    echo "No connection from local db"
    echo "Do this: Open XAMPP cpanel then click Start button in MySQL."
    
    # curl new post request VIBER or something to notify admin
    sleep 3
    exit
else
    echo "Checking web service response..."
        
    if [ -e "../tmp/automailer.txt" ]; then # temp file exists, don't do anything
        echo "automailer is already running..."
        sleep 3
        exit
    else
        touch ../tmp/automailer.txt #hoping that bash doesn't crash

        if [ "$?" = "7" ]; then # not sure why it's 7 lol
            conRefused # if / connection refused means that nodejs isn't running, invoke function instead
        else

            if [ $APIRES != 1 ]; then
                echo "API 404"
                echo "Check the APIRES variable. Link should be indexed" # localhost:8000
                rm ../tmp/automailer.txt
                
                curl -d "gg=err" --max-time 300 http://localhost:8000/404 # send information to admin

                if [ "$?" = "7" ]; then
                    conRefused # if /404 connection refused means that nodejs isn't running, invoke function instead
                fi

                sleep 3 # for us to read the echo
                exit
            else
                echo "Server is ACTIVE"
                curl -d "user=$POSTU&pass=$POSTP" --max-time 300  http://localhost:8000/202
                rm ../tmp/automailer.txt

                # wait for next trigger 6:30 / 18:30
                exit
            fi
        fi
    fi
fi

