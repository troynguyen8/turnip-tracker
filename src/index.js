(() => {
  const islandsRef = db.collection('islands');
  const islandInputForm = document.getElementById('island-form');

  const getIsland = async (name) => {
    const snapShot = await islandsRef.where('name', '==', name).limit(1).get();
    return snapShot.empty ? null : snapShot.docs[0];
  };

  const addNewIsland = async (name) => await islandsRef.add({
    name,
    prices: []
  });

  const addNewPriceToIsland = (islandRef, price) => {
    islandsRef.doc(islandRef.id).update({
      prices: firebase.firestore.FieldValue.arrayUnion({
        price,
        time: new Date()
      })
    });
  };

  const findInsertionIndexFromDate = (date) => {
    const dayIndex = date.getDay();
    const hour = date.getHours();

    let insertionIndex = (dayIndex * 2) - 1;
    if (hour < 12) insertionIndex -= 1;

    return insertionIndex;
  };

  const confinePriceDataToCurrentWeek = (rawPriceData) => {
    const now = new Date();
    let weekBeginning = new Date(); // Monday at 8:00 AM, local time
    let weekEnd = new Date(); // Saturday at 10:00 PM, local time

    if (now.getDay() === 1) {
      weekBeginning.setDate(now.getDate());
    } else {
      weekBeginning.setDate(now.getDate() - (now.getDay() + 6) % 7);
    }

    weekBeginning.setHours(8, 0, 0, 0);
    
    if (now.getDay() === 6) {
      weekEnd.setDate(now.getDate());
    } else if (now.getDay() === 0) {
      weekEnd.setDate(now.getDate() - 1);
    } else {
      weekEnd.setDate(now.getDate() + (6 - now.getDay()));
    }

    weekEnd.setHours(22, 0, 0, 0);

    return rawPriceData.filter((price) => price.time.toDate() >= weekBeginning && price.time.toDate() <= weekEnd);
  };

  const convertRawPricesToChartPrices = (rawPriceData) => {
    const chartPrices = new Array(12).fill(null);

    const filteredPrices = confinePriceDataToCurrentWeek(rawPriceData);

    filteredPrices.forEach((rawPrice) => {
      const date = rawPrice.time.toDate();
      chartPrices[findInsertionIndexFromDate(date)] = rawPrice.price;
    });

    return chartPrices;
  };

  const initChart = (islandName, priceData) => {
    const canvasCtx = document.getElementById('turnip-chart').getContext('2d');
    return new Chart(canvasCtx, {
      type: 'line',
      data: {
        labels: ['M-AM', 'M-PM', 'T-AM', 'T-PM', 'W-AM', 'W-PM', 'R-AM', 'R-PM', 'F-AM', 'F-PM', 'S-AM', 'S-PM'],
        datasets: [{
          label: `${islandName} Turnip Prices`,
          data: priceData,
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderColor: '#218838'
        }]
      }
    })
  };

  islandInputForm.onsubmit = async (event) => {
    event.preventDefault();

    const islandName = event.currentTarget[0].value.toUpperCase();

    if (!islandName.trim()) {
      alert('Enter a non-empty island name!');
      return null;
    }

    let islandRef = await getIsland(islandName);

    if (!islandRef) {
      islandRef = await addNewIsland(islandName);
    }

    const islandFormContainer = document.getElementById('island-form-container');
    islandFormContainer.classList.remove('d-flex');
    islandFormContainer.classList.add('d-none');
    document.getElementById('island-info-container').classList.remove('d-none');
    document.getElementById('island-name').innerHTML = islandName;

    const islandData = islandRef.data ?
      islandRef.data() :
      {
        name: islandName,
        prices: [],
      };

    const chart = initChart(islandData.name, convertRawPricesToChartPrices(islandData.prices));

    const priceAddForm = document.getElementById('price-add-form');
    priceAddForm.onsubmit = (priceAddEvent) => {
      priceAddEvent.preventDefault();

      const currentPrice = priceAddEvent.currentTarget[0].value;
      if (isNaN(currentPrice)) {
        alert('Enter a valid number!');
        return null;
      }

      priceAddEvent.currentTarget[0].value = '';

      addNewPriceToIsland(islandRef, +currentPrice);

      chart.data.datasets[0].data[findInsertionIndexFromDate(new Date())] = +currentPrice;
      chart.update();
    };
  };
})();
