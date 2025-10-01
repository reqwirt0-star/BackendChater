// addUser.js - Скрипт для генерации SQL-запроса для добавления нового пользователя

const bcrypt = require('bcryptjs');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('--- Создание нового пользователя ---');

readline.question('Введите имя пользователя (username): ', username => {
  readline.question('Введите пароль: ', password => {
    readline.question('Введите роль (manager или employee): ', role => {

      if (!username || !password || !role) {
        console.error('\n[ОШИБКА] Все поля должны быть заполнены.');
        readline.close();
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      console.log('\n--- ГОТОВО! ---');
      console.log('Скопируйте следующий SQL-запрос и выполните его в SQL Editor вашего проекта Supabase:\n');

      const query = `INSERT INTO users (username, password_hash, role) VALUES ('${username}', '${hash}', '${role}');`;

      console.log(query);

      readline.close();
    });
  });
});