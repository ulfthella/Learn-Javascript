const batas = '-------------------------';
console.log(batas);
const usn = [
    'Yandi',
    'Dimas',
    'Mita'
];

/* length berfungsi menghitung jumlah data pada array*/
const text = 'ada total ' + usn.length + ' username';
console.log (text);

console.log (batas);

/* includes() digunakan mengecek data (mengembalikan nilai boolean)  */
const newUsername = 'dkk';
const isTaken = usn.includes(newUsername);

if (isTaken){
    console.log('username sudah digunakan');
} else {
    console.log('username masih tersedia');
}

console.log (batas);

/* guanakan [] untuk mengakses index statements*/
console.log (usn[1]);

console.log (batas);

const favFoods = [
    'mie ayam',
    'bakso',
    'seblak',
    'es krim'
];

const text2 = ('Makanan favoritku yang kedua adalah ' + favFoods[1]);
console.log (text2);

console.log(batas);
