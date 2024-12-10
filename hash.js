// Hashing function
function customEncrypt(numberString) {
    return numberString
        .split('') // Split the number into individual digits
        .map(num => {
            const modResult = (parseInt(num) + 7) % 26; // Add 7 and take modulo 26
            return String.fromCharCode(modResult + 97); // Map to 'a-z'
        })
        .join(''); // Join the letters back into a string
}

// Decryption function
function customDecrypt(hashString) {
    return hashString
        .split('') // Split the hash into individual characters
        .map(char => {
            const modResult = (char.charCodeAt(0) - 97 - 7 + 26) % 26; // Reverse the operation
            return modResult.toString(); // Convert back to a string
        })
        .join(''); // Join the numbers back into a string
}

// // Example usage
// const numberString = "123"; // Original number as a string
// const encrypted = encrypt(numberString); // Encrypt
// console.log('Encrypted:', encrypted); // Output: Encrypted hash

// const decrypted = decrypt(encrypted); // Decrypt
// console.log('Decrypted:', decrypted); // Output: Original number string

module.exports = { customEncrypt, customDecrypt };
