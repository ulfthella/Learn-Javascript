/* materi */
function sayHappyBirthday(name, age) {
    console.log('Selamat Ulang Tahun ke ' + age + ', ' + name);
};

sayHappyBirthday('ulf_thella', 18);  /* cara memanggil function*/
sayHappyBirthday('black kwit', 18); 
sayHappyBirthday('johans.gara', 25); 

const batas = '-------------------';
console.log(batas);

/* challenge */
function sayName() {
    console.log('ulf_thella');
};

sayName();
sayName();
sayName();
sayName(); 

console.log(batas);

function logNumberType(number) {
    if (number < 0){
        console.log('negatif');
    } else if (number > 0){
        console.log('positif');
    } else {
        console.log('netral');
    }
};

logNumberType(2837452930);
console.log(batas);

function add(x, y) {
    const z = x + y;
    console.log( x + ' ditambah ' + y + ' sama dengan ' + z);
};

add(1, 6);