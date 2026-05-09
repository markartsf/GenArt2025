//配列のシャッフル
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

//配列のリピート複製
function repeatArray(array, repeatCount = 3) {
  return Array(repeatCount).fill().flatMap(() => array);
}

//配列からランダムに1つの要素を取得して返す関数
function getRandomElementFromArray(array) {
  if (!Array.isArray(array) || array.length === 0) {
    console.error('Invalid input: array must be a non-empty array');
    return null;
  }
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

// ランダムな整数を取得
function randomInt(minNum, maxNum) {
  return minNum + Math.floor(Math.random() * (maxNum - minNum + 1));
}

// ランダムな偶数を取得
function randomEvenInt(minNum, maxNum) {
  if (minNum % 2 !== 0) {
    minNum++;
  }
  if (maxNum % 2 !== 0) {
    maxNum--;
  }
  if (minNum > maxNum) {
    return null;
  }
  const randomEven = minNum + 2 * Math.floor(Math.random() * ((maxNum - minNum) / 2 + 1));
  return randomEven;
}

// ランダムな奇数を取得
function randomOddInt(minNum, maxNum) {
  if (minNum % 2 === 0) {
    minNum++;
  }
  if (maxNum % 2 === 0) {
    maxNum--;
  }
  if (minNum > maxNum) {
    return null;
  }
  const randomOdd = minNum + 2 * Math.floor(Math.random() * ((maxNum - minNum) / 2 + 1));
  return randomOdd;
}

// 整数numの約数を昇順で一覧と数を返す
function divisor(num) {
  const results = [];
  const sqrt = Math.Math.floor(Math.sqrt(num));
  // 1から平方根までの約数を求める
  for (let i = 1; i <= sqrt; i++) {
    if (num % i === 0) {
      results.push(i); // 約数を追加
      if (i !== num / i) { // 別の約数がある場合
        results.push(num / i); // その約数も追加
      }
    }
  }
  // 昇順に並び替え
  results.sort((a, b) => a - b);
  return {
    divisors: results,
    count: results.length
  };
}

// 乱数が指定されたしきい値以下であるかどうかを判定する
function isRandomBelowThreshold(threshold = 0.1) {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    throw new Error('Invalid threshold value. It must be a number between 0 and 1.');
  }
  const rand = Math.random();
  return rand < threshold;
}

//数を限定した配列を返す
function getArrayWithLimitedLength(array, limit) {
  const maxLength = limit === undefined ? array.length : Math.min(array.length, limit);
  return array.slice(0, maxLength);
}

//0から指定された上限値までの乱数による角度(ラジアン)を生成する
function getRandomAngleInRadians(maxAngle = TWO_PI) {
  return Math.random() * maxAngle;
}

//指定された数のステップから、ランダムな角度(ラジアン)を生成する
function getRandomStepAngleInRadians(numSteps, minAngle = 0, maxAngle = TWO_PI) {
  if (numSteps <= 0 || !Number.isFinite(numSteps)) {
    throw new Error('numSteps must be a positive finite number');
  }
  if (!Number.isFinite(minAngle) || !Number.isFinite(maxAngle)) {
    throw new Error('minAngle and maxAngle must be finite numbers');
  }
  if (minAngle >= maxAngle) {
    throw new Error('minAngle must be less than maxAngle');
  }
  const angleRange = maxAngle - minAngle;
  const stepAngle = angleRange / numSteps;
  const randomStep = Math.floor(Math.random() * numSteps);
  return minAngle + (randomStep * stepAngle);
}

//2点間の角度（ラジアン）を計算する関数
function getAngleBetweenPoints(x1, y1, x2, y2) {
  return atan2(y2 - y1, x2 - x1);
}

//配列の最後に指定した要素を追加し、配列の先頭と末尾を接続したような円形(循環)の配列を作成する関数
function circularizeElements(array, element) {
  const circularArray = [...array];
  circularArray.push(element);
  return circularArray;
}

// 指定した数だけ元の配列の要素を繰り返し使用して新しい配列を生成する関数
function assignCycleElements(array, count) {
  if (!Array.isArray(array) || array.length === 0) {
    console.error('Invalid input: array must be a non-empty array');
    return [];
  }
  const result = [];
  for (let i = 0; i < count; i++) {
    const index = i % array.length;
    result.push(array[index]);
  }
  return result;
}

// 指定した数だけ元の配列からランダムに要素を選択して新しい配列を生成する関数
function assignRandomElements(array, count) {
  if (!Array.isArray(array) || array.length === 0) {
    console.error('Invalid input: array must be a non-empty array');
    return [];
  }
  const result = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * array.length);
    result.push(array[randomIndex]);
  }
  return result;
}

// 重み付けされた確率に基づいて要素を選択し、指定した数だけ新しい配列を生成する関数
function assignWeightedElements(array, weights, count) {
  if (!Array.isArray(array) || array.length === 0) {
    console.error('Invalid input: array must be a non-empty array');
    return [];
  }
  const fullWeights = weights.length < array.length
    ? [...weights, ...Array(array.length - weights.length).fill(1)]
    : weights;

  if (fullWeights.length < array.length) {
    console.error('Invalid input: weights array is too short');
    return [];
  }
  const totalWeight = fullWeights.reduce((sum, weight) => sum + weight, 0);
  const result = [];
  for (let i = 0; i < count; i++) {
    let random = Math.random() * totalWeight;
    let chosenElement;
    for (let j = 0; j < array.length; j++) {
      random -= fullWeights[j];
      if (random <= 0) {
        chosenElement = array[j];
        break;
      }
    }
    result.push(chosenElement);
  }
  return result;
}

// 元の配列の要素をできるだけ均等に使用して、指定した数だけ新しい配列を生成する関数
function assignBalancedElements(array, count) {
  if (!Array.isArray(array) || array.length === 0) {
    console.error('Invalid input: array must be a non-empty array');
    return [];
  }
  const result = [];
  const elementCounts = {};
  array.forEach(element => elementCounts[element] = 0);
  for (let i = 0; i < Math.min(array.length, count); i++) {
    result.push(array[i]);
    elementCounts[array[i]]++;
  }
  for (let i = array.length; i < count; i++) {
    const leastUsedElement = Object.entries(elementCounts).reduce(
      (min, [element, count]) => count < min[1] ? [element, count] : min,
      [null, Infinity]
    )[0];
    result.push(leastUsedElement);
    elementCounts[leastUsedElement]++;
  }
  return result;
}

//閾値に基づいて0または指定値をランダムに返す関数
function getRandomBinary(threshold, value) {
  return (Math.random() > threshold) ? 0 : value;
}

// 小さい値が出やすいランダム関数
function skewed(min, max, exponent = 2) {
  const r = 1 - random();
  const skew = Math.pow(r, exponent);
  return min + skew * (max - min);
}

// 整数バージョン
function skewedInt(min, max, exponent = 2) {
  return Math.floor(skewed(min, max + 0.999, exponent));
}

// 三角分布（より単純なランダム分布）
function triangular(min, max) {
  const r1 = random(min, max);
  const r2 = random(min, max);
  return Math.min(r1, r2);
}

// 三角分布の整数バージョン
function triangularInt(min, max) {
  return Math.floor(triangular(min, max + 0.999));
}

// ガウス分布を使ったランダム関数
function gaussian(min, max, skewFactor = 0.3) {
  const mean = min + (max - min) * skewFactor;
  const stdDev = (max - min) / 3;
  let val;
  do {
    val = randomGaussian(mean, stdDev);
  } while (val < min || val > max);
  return val;
}

// ガウス分布の整数バージョン
function gaussianInt(min, max, skewFactor = 0.3) {
  return Math.floor(gaussian(min, max + 0.999, skewFactor));
}