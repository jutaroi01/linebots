var async = require('async');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var line = require('@line/bot-sdk');
var NCMB = require("ncmb");
// var request = require('request');

var linebotsNCMB =
    new NCMB(process.env.SUSHI_NCMB_APPKEY, process.env.SUSHI_NCMB_CLIKEY);

var app = express();
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: true}));  // JSONの送信を許可
app.use(bodyParser.json());                        // JSONのパースを楽に（受信時）

app.post('/yubaba', function(req, res) {
    async.waterfall([
            function(next) {
                // リクエストがLINE Platformから送られてきたか確認する
                if (!validateSignature(req, process.env.YUBABA_CHANNEL_SECRET)) {
                    console.log('ERROR: request header check NG');
                    return;
                }
                // テキストが送られてきた場合のみ返事をする
                if (req.body['events'][0]['type'] != 'message' ||
                    req.body['events'][0]['message']['type'] != 'text') {
                    console.log('ERROR: request body check NG');
                    return;
                }
                next();
            },
            function(next) { // 新しい名前を生成
                var oldName = req.body['events'][0]['message']['text']
                // 名前は3～11文字のみ有効
                if (oldName.length < 3 || oldName.length > 11) {
                    console.log('ERROR: oldName length invalid. length=' + oldName.length);
                    return;
                }
                // 新しい名前の長さは、最小で2、最大で名前の文字数-2 or 4
                var newNameLen = Math.floor(Math.random() * (oldName.length - 3) ) + 2;
                if (newNameLen > 4) newNameLen = 4;
                // 新しい名前に使う文字のindexの配列
                var array = [];
                for (var i = 0; i < newNameLen; i++) {
                    while (true) {
                        var index = Math.floor(Math.random() * oldName.length);
                        if (array.indexOf(index) < 0) {
                            array.push(index);
                            break;
                        }
                    }
                }
                // 配列を昇順ソートしてから新しい名前を組み立て
                var newName = '';
                array.sort().forEach(function(v, i, a) {
                    newName = newName + oldName.charAt(v);
                })
                next(null, oldName, newName);
            }
        ],
        function(err, oldName, newName) {
            if(err){
                return;
            }
            var client = new line.Client({
                channelAccessToken: process.env.YUBABA_ACCESS_TOKEN
            });
            var message = [{
                    type: 'text',
                    text: '「' + oldName + '」なんて生意気だね'
                }, {
                    type: 'text',
                    text: '今日からあんたは「' + newName + '」だよ'
                }];
            client.replyMessage(req.body['events'][0]['replyToken'], message)
                .then(() => {
                    // console.log('DEBUG: reply success: ' + JSON.stringify(message));
                })
                .catch((err) => {
                    console.log('ERROR: reply error: ' + err);
                });
    });
    res.send();
});

app.post('/sushi', function(req, res) {
    async.waterfall([
            validateSignatureTask(req, process.env.SUSHI_CHANNEL_SECRET),
            getTmpDataTask(req.body['events'][0]['source']['userId'], 'Sushi'),
            sushiMainTask(req.body['events'][0]['message']['text'])
        ],
        replyCallback(req.body['events'][0]['replyToken'], process.env.SUSHI_ACCESS_TOKEN)
    );
    res.send();
});

// userIdを指定してNCMB上のデータを取得or存在しなければ作成する
function getTmpDataTask(userId, className) {
    return function(next) { // get tmpData
        var MyClass = linebotsNCMB.DataStore(className);
        MyClass.equalTo('userId', userId)
            .fetch()
            .then(function(result){
                if(Object.keys(result).length != 0){ // data exist
                    next(null, result);
                } else {
                    var myClass = new MyClass();
                    myClass.set('userId', userId)
                        .set('dataArray', [])
                        .save()
                        .then(function(data){
                            next(null, data);
                        })
                        .catch(function(err){
                            next('save failed:' + JSON.stringify(err));
                        })
                }
            })
            .catch(function(err){
                next('fetch failed:' + JSON.stringify(err));
            });
    }
}

// メッセージに応じてメイン処理を実行
function sushiMainTask(text) {
    return function(tmpData, next) {
        var Sushi = linebotsNCMB.DataStore('Sushi');
        if(text == 'おあいそ'){
            var ret = [];
            if(tmpData['dataArray'].length == 0){
                ret.push('まだ何も食べてないよ');
            } else {
                ret.push(tmpData['dataArray'].join('\n'));
                ret.push('合計' + tmpData['dataArray'].length + '貫食べたよ');
            }
            next(null, ret);
        } else if(text == 'リセット'){
            var sushi = new Sushi();
            sushi.set('objectId', tmpData['objectId'])
                .set('dataArray', [])
                .update()
                .then(function(result){
                    next(null, ['リセットしたよ']);
                })
                .catch(function(err){
                    next('reset failed:' + JSON.stringify(err));
                });
        } else {
            // 改行と半角スペースを区切りとして配列化し、ついでに空要素を排除
            var newArray = text.split(/[\n\s]/).filter(function(elem){
                return elem;
            });
            var sushi = new Sushi();
            sushi.set('objectId', tmpData['objectId'])
            newArray.forEach(function(elem){
                sushi.add('dataArray', elem);
            });
            sushi.update()
                .then(function(result){
                    var ret = [];
                    ret.push(newArray.join('\n'));
                    ret.push(newArray.length + '貫追加したよ');
                    next(null, ret);
                })
                .catch(function(err){
                    next('add failed:' + JSON.stringify(err));
                });
        };
    }
}

app.post('/fandc', function(req, res) {
    async.waterfall([
            validateSignatureTask(req, process.env.FANDC_CHANNEL_SECRET),
            getTmpDataTask(req.body['events'][0]['source']['userId'], 'FandC'),
            fandCMainTask(req.body['events'][0]['message']['text'])
        ],
        replyCallback(req.body['events'][0]['replyToken'], process.env.FANDC_ACCESS_TOKEN)
    );
    res.send();
});

var FANDC_ARRAY = ['フィッシュ', 'チップス', 'ふぃっしゅ', 'ちっぷす',
                   'fish', 'chips', 'Fish', 'Chips', 'FISH', 'CHIPS']

function fandCMainTask(text) {
    return function(tmpData, next) {
        var FandC = linebotsNCMB.DataStore('FandC');
        if(text == 'トータル'){
            var ret = [];
            if(tmpData['dataArray'].length == 0){
                ret.push('いいから食え');
            } else {
                ret.push(tmpData['dataArray'].join('&'));
            }
            next(null, ret);
        } else if(text == 'リセット'){
            var fandc = new FandC();
            fandc.set('objectId', tmpData['objectId'])
                .set('dataArray', [])
                .update()
                .then(function(result){
                    next(null, ['ゼロから食え']);
                })
                .catch(function(err){
                    next('reset failed:' + JSON.stringify(err));
                });
        } else {
            // 改行と半角スペースを区切りとして配列化し、ついでに空要素を排除
            var newArray = text.split(/[\n\s]/).filter(function(elem){
                return elem;
            });
            // すべての要素がFANDC_ARRAYのいずれかにマッチすればOK
            if(newArray.every(function(elem){return FANDC_ARRAY.includes(elem);})) {
                var fandc = new FandC();
                fandc.set('objectId', tmpData['objectId'])
                newArray.forEach(function(elem){
                    fandc.add('dataArray', elem);
                });
                fandc.update()
                    .then(function(result){
                        next(null, [tmpData['dataArray'].concat(newArray).join('&')]);
                    })
                    .catch(function(err){
                        next('add failed:' + JSON.stringify(err));
                    });
            } else {
                next(null, ['は？']);
            }
        };
    }
}

app.listen(app.get ('port'), function() {
    console.log('Node app is running');
});

// 署名検証およびテキストか否か判定するタスク
function validateSignatureTask(request, secret) {
    return function(next) {
        if (!validateSignature(request, secret)) {
            next('ERROR: request header check NG');
        } else if (request.body['events'][0]['type'] != 'message' ||
            request.body['events'][0]['message']['type'] != 'text') {
            next('ERROR: request body check NG');
        } else {
            next();
        }
    }
}

// 署名検証
function validateSignature(request, secret) {
    return request.headers['x-line-signature'] == crypto.createHmac('SHA256', secret)
        .update(new Buffer(JSON.stringify(request.body), 'utf8')).digest('base64');
}

// 返信メッセージを作成、送信するコールバック
function replyCallback(replyToken, accessToken) {
    return function(error, result) {
        if(error){
            console.log(error);
            return;
        }
        var client = new line.Client({
            channelAccessToken: accessToken
        });
        var message = [];
        result.forEach(function(elem){
            message.push({
                type: 'text',
                text: elem
            })
        });
        client.replyMessage(replyToken, message)
            .then(() => {
                // console.log('DEBUG: reply success: ' + JSON.stringify(message));
            })
            .catch((err) => {
                console.log('ERROR: reply error: ' + err);
            });
    }
}
