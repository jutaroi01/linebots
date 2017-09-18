// 入力されてきた名前
var oldName = process.argv[2] || "サンプル太郎";

// 名前は3～11文字のみ有効
if (oldName < 3 || oldName > 11) {
    console.log("名前は3～11文字のみ有効");
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
var newName = "";
array.sort().forEach(function(v, i, a) {
    newName = newName + oldName.charAt(v);
})

console.log("「" + oldName + "」なんて生意気だね");
console.log("今日からあんたは「" + newName + "」だよ");

// var tmpName = oldName;
// var newName = "";
// for (var i = 0; i < Math.floor(Math.random() * (oldName.length - 2) ) + 2; i++) {
//     var index = Math.floor(Math.random() * tmpName.length);
//     newName = newName + tmpName.charAt(index);
//     tmpName = tmpName.slice(0, index) + tmpName.slice(index + 1);  
// }

// console.log("「" + oldName + "」なんて生意気だね");
// console.log("今日からあんたは「" + newName + "」だよ");
