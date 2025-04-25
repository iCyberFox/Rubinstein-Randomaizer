  let allParticipants = [];
  let selectedWinners = [];

  document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const numberKey = Object.keys(jsonData[0]).find(
        key => key.toLowerCase().trim() === 'number'
      );
      const nameKey = Object.keys(jsonData[0]).find(
        key => key.toLowerCase().trim() === 'name'
      );

      if (!numberKey || !nameKey) {
        alert('Не знайдено колонки "Number" або "Name" у файлі!');
        return;
      }

      const uniqueMap = new Map();

      jsonData.forEach(row => {
        const name = row[nameKey].trim();
        const number = row[numberKey];
        if (name && !uniqueMap.has(name)) {
          uniqueMap.set(name, { name, number });
        }
      });

      allParticipants = Array.from(uniqueMap.values());
      selectedWinners = [];

      alert(`Знайдено ${allParticipants.length} унікальних учасників`);
      updateWinnersList();
    };

    reader.readAsArrayBuffer(file);
  });

  function pickSingleWinner() {
    const winnerCount = parseInt(document.getElementById('winnerCount').value);
    if (selectedWinners.length >= winnerCount) {
      alert("Досягнуто максимальну кількість переможців.");
      return;
    }

    const remaining = allParticipants.filter(p =>
      !selectedWinners.find(w => w.name === p.name)
    );

    if (remaining.length === 0) {
      alert("Більше немає доступних учасників.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * remaining.length);
    const winner = remaining[randomIndex];
    selectedWinners.push(winner);
    updateWinnersList();
  }

  function updateWinnersList() {
    const winnerList = selectedWinners.map(w =>
      `<li>#${w.number}: ${w.name}</li>`
    ).join('');

    document.getElementById('winners').innerHTML = `
      <h3>Переможці:</h3>
      <ol>
          ${selectedWinners.map(w => `<li>№ ${w.number}, Ім'я: ${w.name}</li>`).join('')}
        </ol>
    `;
  }

  function saveToFile() {
    if (selectedWinners.length === 0) {
      alert("Немає переможців для збереження.");
      return;
    }

    const text = selectedWinners.map(w => `#${w.number}: ${w.name}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'winners.txt';
    a.click();
    URL.revokeObjectURL(url);
  }