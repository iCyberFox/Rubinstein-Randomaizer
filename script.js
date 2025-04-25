    let uniqueNames = [];

    document.getElementById('fileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Автоматичне визначення колонки з "Name" (без урахування регістру)
        const nameKey = Object.keys(jsonData[0]).find(
          key => key.toLowerCase().trim() === 'name'
        );

        if (!nameKey) {
          alert('Не знайдено колонку з назвою "Name" у файлі!');
          return;
        }

        const allNames = jsonData.map(row => row[nameKey]).filter(name => !!name.trim());
        uniqueNames = [...new Set(allNames)];

        alert(`Знайдено ${uniqueNames.length} унікальних користувачів`);
      };

      reader.readAsArrayBuffer(file);
    });

    function pickWinners() {
      const count = parseInt(document.getElementById('winnerCount').value);
      if (uniqueNames.length === 0) {
        alert("Будь ласка, завантаж спочатку файл!");
        return;
      }

      if (count > uniqueNames.length) {
        alert(`Кількість переможців не може бути більшою за кількість унікальних учасників (${uniqueNames.length})`);
        return;
      }

      const shuffled = [...uniqueNames].sort(() => 0.5 - Math.random());
      const winners = shuffled.slice(0, count);

      document.getElementById('winners').innerHTML = `
        <h3>Переможці:</h3>
        <ol>${winners.map(name => `<li>${name}</li>`).join('')}</ol>
      `;
    }