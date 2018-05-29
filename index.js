var async = require('async');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var line = require('@line/bot-sdk');
var request = require('request');

var app = express();
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: true}));  // JSONの送信を許可
app.use(bodyParser.json());                        // JSONのパースを楽に（受信時）

app.post('/yuba-ba', function(req, res) {
    async.waterfall([
            function(next) {
                // リクエストがLINE Platformから送られてきたか確認する
                if (!validate_signature(req.headers['x-line-signature'], req.body)) {
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
                channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
            });
            var message = [{
                    'type': 'image',
                    'originalContentUrl': 'https://raw.githubusercontent.com/jutaroi01/yuba-ba/master/public/image/yuba-ba.png',
                    'previewImageUrl': 'https://raw.githubusercontent.com/jutaroi01/yuba-ba/master/public/image/yuba-ba.png'
                },{
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
app.listen(app.get ('port'), function() {
    console.log('Node app is running');
});

// 署名検証
function validate_signature(signature, body) {
    return signature == crypto.createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
        .update(new Buffer(JSON.stringify(body), 'utf8')).digest('base64');
}
