var async = require('async');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var line = require('@line/bot-sdk');
var NCMB = require("ncmb");
// var request = require('request');

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
    var ncmb = new NCMB(process.env.SUSHI_NCMB_APPKEY,
        process.env.SUSHI_NCMB_CLIKEY);
    var History = ncmb.DataStore('History');
    async.waterfall([
        function(next) {
            if (!validateSignature(req, process.env.SUSHI_CHANNEL_SECRET)) {
                console.log('ERROR: request header check NG');
                return;
            }
            if (req.body['events'][0]['type'] != 'message' ||
                req.body['events'][0]['message']['type'] != 'text') {
                console.log('ERROR: request body check NG');
                return;
            }
            next();
        },
        function(next) { // get tmpData
            var userId = req.body['events'][0]['source']['userId'];
            History.equalTo('userId', userId)
                .fetch()
                .then(function(result){
                    if(Object.keys(result).length != 0){ // data exist
                        next(null, result);
                    } else {
                        var history = new History();
                        history.set('userId', userId)
                            .set('netaArray', [])
                            .save()
                            .then(function(data){
                                next(null, data);
                            })
                            .catch(function(err){
                                console.log(err);
                            })
                    }
                })
                .catch(function(err){
                    console.log(err);
                });
        },
        function(tmpData, next) {
            var text = req.body['events'][0]['message']['text'];
            if(text == 'おあいそ'){
                var ret = [];
                ret.push(tmpData['netaArray'].join('\n'));
                ret.push('合計 ' + tmpData['netaArray'].length + '皿食べたよ');
                next(null, ret);
            } else if(text == 'リセット'){
                var history = new History();
                history.set('objectId', tmpData['objectId'])
                    .set('netaArray', [])
                    .update()
                    .then(function(result){
                        next(null, ['リセットしたよ']);
                    })
                    .catch(function(err){
                        console.log(err);
                    });
            } else {
                // 改行と半角スペースを区切りとして配列化し、ついでに空要素を排除
                var newArray = text.split(/[\n\s]/).filter(function(elem){
                    return elem;
                });
                var history = new History();
                history.set('objectId', tmpData['objectId'])
                newArray.forEach(function(elem){
                    history.add('netaArray', elem);
                });
                history.update()
                    .then(function(result){
                        var ret = [];
                        ret.push(newArray.join('\n'));
                        ret.push(newArray.length + '皿追加したよ');
                        next(null, ret);
                    })
                    .catch(function(err){
                        console.log(err);
                    });
            };
        }],
        function(err, result) {
            if(err){
                return;
            }
            var client = new line.Client({
                channelAccessToken: process.env.SUSHI_ACCESS_TOKEN
            });
            var message = [];
            result.forEach(function(elem){
                message.push({
                    type: 'text',
                    text: elem
                })
            });
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

app.listen(app.get ('port'), function() {
    console.log('Node app is running');
});

// 署名検証
function validateSignature(request, secret) {
    return request.headers['x-line-signature'] == crypto.createHmac('SHA256', secret)
        .update(new Buffer(JSON.stringify(request.body), 'utf8')).digest('base64');
}
