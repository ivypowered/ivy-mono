# Token

The IVY token is the ownership unit of the Ivy platform. It was launched on 6 May 2025.

## Supply

The initial supply of IVY is 1,000,000. It follows a simple distribution:

- 33% to shareholders (team members and initial investors)
- 67% to the community, distributed on a curve

<div style="max-width: 400px; margin: 0 auto;">
    <canvas id="ivyAllocationChart"></canvas>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
(function() {
    var ctx = document.getElementById('ivyAllocationChart').getContext('2d');
    var data = [666667, 333333];
    var totalSum = data.reduce((a, b) => a + b, 0);
    var percentages = data.map(value => ((value / totalSum) * 100).toFixed(2));
    var ivyAllocationChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Community', 'Shareholders'],
            datasets: [{
                data: data,
                backgroundColor: ['#34D399', '#6EE7B7'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            devicePixelRatio: 2.5,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                                var label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                var value = context.raw;
                                var percentage = percentages[context.dataIndex];
                                label += value.toLocaleString() + ' IVY (' + percentage + '%)';
                                return label;
                            }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: 'rgba(226, 228, 233, 0.82)'
                    }
                },
                title: {
                    display: true,
                    text: 'IVY Allocation',
                    color: 'rgba(226, 228, 233, 0.82)'
                }
            }
        }
    });
})();
</script>

## Team Allocation

The 333,333 IVY tokens allocated to the team are distributed via a simplified vesting mechanism. At any point in time, if X% of the IVY in the community allocation has been purchased, then X% of the IVY in the team allocation will be available to the team. For example, if 25% of the IVY community allocation has been purchased, then 25% of the tokens in the IVY team allocation will be released. This ensures that the ratio of team-allocated tokens to community-allocated tokens is always 33.3%-66.7% at any given point in time.

## Community Allocation

The 666,667 IVY tokens allocated to the community are distributed on a curve defined in the Ivy smart contract. This method of distribution was chosen because it's relatively fair and provides the token with initial liquidity.

The IVY curve is governed by the formula `price (USDC) = sqrt(0.375 * amount_sold)`, where `price` is the price of the next IVY token in USDC, and `amount_sold` is the number of IVY tokens purchased from the community allocation.

The price of IVY tokens from the community pool starts low and increases as more tokens are bought to a maximum of $500 per IVY.

<div style="max-width: 600px; margin: 0 auto;">
    <canvas id="ivyBondingCurvePriceChart"></canvas>
</div>
<script>
(function() {
    var ctx = document.getElementById('ivyBondingCurvePriceChart').getContext('2d');
    var bondingCurveData = [];
    var maxCommunitySupply = 666667;
    var constant = 0.375;
    var numPoints = 400;

    if (maxCommunitySupply <= 0) {

        bondingCurveData.push({ x: 0, y: 0 });
    } else {

        for (let i = 0; i < numPoints; i++) {
            let supplySold;
            if (numPoints === 1) {


                supplySold = maxCommunitySupply;
            } else {

                supplySold = (i / (numPoints - 1)) * maxCommunitySupply;
            }

            let price = 0;
            if (supplySold > 0) {
                price = Math.sqrt(constant * supplySold);
            }
            bondingCurveData.push({ x: supplySold, y: price });
        }
    }

    var ivyBondingCurvePriceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'IVY Price',
                data: bondingCurveData,
                borderColor: '#34D399',
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                fill: true,
                tension: 0,
                pointRadius: 0,
                borderWidth: 1,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            devicePixelRatio: 2.5,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'IVY Sold',
                        color: 'rgba(226, 228, 233, 0.82)'
                    },
                    ticks: {
                        color: 'rgba(226, 228, 233, 0.82)',
                        callback: function(value, index, values) {
                            return value.toLocaleString();
                        }
                    },
                    min: 0,
                    max: maxCommunitySupply
                },
                y: {
                    title: {
                        display: true,
                        text: 'IVY Price',
                        color: 'rgba(226, 228, 233, 0.82)'
                    },
                    ticks: {
                        color: 'rgba(226, 228, 233, 0.82)',
                        callback: function(value, index, values) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false,
                    position: 'top',
                    labels: {
                        color: 'rgba(226, 228, 233, 0.82)'
                    }
                },
                title: {
                    display: true,
                    text: 'IVY Curve',
                    color: 'rgba(226, 228, 233, 0.82)'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {

                            const supplySold = tooltipItems[0].parsed.x;

                            return 'IVY Sold: ' + supplySold.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            hover: {
                mode: 'index',
                intersect: false
            }
        }
    });

})();
</script>

Anyone can buy and sell along the IVY curve at any time, and these swaps do not incur any fees. All USDC used to purchase IVY is locked into the contract until IVY is sold for it, providing indefinite liquidity for the price of IVY.

## Economics

The Ivy platform generates revenue by charging a 1% fee on swaps. 50% of the fee is collected in the game token, and is returned to game developers as a revenue share. The other 50% is collected in IVY, and is immediately burned, directly benefiting IVY holders.
