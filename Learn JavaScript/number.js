/* sebuah angka dan perhitungan */
/* run time untuk melihat output kode */

const priceApple = 5000;
const priceBanana = 10000;
const totalApple = 3;
const totalBanana = 2;
const discount = 10000;
const disc = 0.1;

const originalPrice = priceApple * totalApple + priceBanana * totalBanana;
const totalPrice = originalPrice - originalPrice * disc;

console.log(totalPrice);