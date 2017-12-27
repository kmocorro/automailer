# !/bin/bash
# curl outs
# Xtranghero
# 2017-12-27
# Version 1.0

DATEnow=`date +%d-%b-%Y`
SHIFTnow=`date +%p`
ProcessList=(DAMAGE POLY BSGDEP NTM NOXE NDEP PTM TOXE CLEANTEX PDRIVE ARC_BARC PBA LCM SEED FGA PLM EDG_CTR PLATING ETCHBK TEST)

if [ $SHIFTnow == 'AM' ]; then

    DATEgo=`date +%d-%b-%Y -d yesterday`
    SHIFTgo='PM'

    echo $DATEgo
    echo $SHIFTgo

    curl -d "qtr=&week=&day=$DATEgo&shift=$SHIFTgo&process_id=&interval=60&format=html&submitbutton=Submit&page=reports&task=hourly_monitoring" http://fab4mes/MESVER4/mes_spml/index.php? > ../tmp/curledOuts.txt

    File=../tmp/curledOuts.txt
    truncate -s 0 ../tmp/outs.json
    echo '{"outs": {}}' > ../tmp/outs.json

    for Process in ${ProcessList[@]}
    do 
        grep -n $Process $File | tail -1 > ../tmp/nOuts.txt

        while read Line
        do 
            Num=`echo $Line | awk -F: '{ print $1 }'`
            SNum=`expr $Num + 25`
                
            TotalOuts=`head -$SNum $File | tail -1 | awk -F\> '{ print $2 }' | awk -F\< '{ print $1 }'`

            sed -i '$s/}/\n"'$Process'": '"$TotalOuts"',}/' ../tmp/outs.json
        done < ../tmp/nOuts.txt
    done
    sed -i '$s/,}}/}}/' ../tmp/outs.json
    
elif [ $SHIFTnow == 'PM' ]; then

    DATEgo=`date +%d-%b-%Y`
    SHIFTgo='AM'

    echo $DATEgo $SHIFTgo

    curl -d "qtr=&week=&day=$DATEgo&shift=$SHIFTgo&process_id=&interval=60&format=html&submitbutton=Submit&page=reports&task=hourly_monitoring" http://fab4mes/MESVER4/mes_spml/index.php? > ../tmp/curledOuts.txt

    File=../tmp/curledOuts.txt
    truncate -s 0 ../tmp/outs.json
    echo '{"outs": {}}' > ../tmp/outs.json

    for Process in "${ProcessList[@]}"
    do 
        grep -n $Process $File | tail -1 > ../tmp/nOuts.txt

        while read Line
        do 
            echo $Line
            Num=`echo $Line | awk -F: '{ print $1 }'`
            SNum=`expr $Num + 25`
                
            TotalOuts=`head -$SNum $File | tail -1 | awk -F\> '{ print $2 }' | awk -F\< '{ print $1 }'`

            sed -i '$s/}/\n"'$Process'": '"$TotalOuts"',}/' ../tmp/outs.json
        done < ../tmp/nOuts.txt
    done
    sed -i '$s/,}}/}}/' ../tmp/outs.json
    
fi
sleep 5