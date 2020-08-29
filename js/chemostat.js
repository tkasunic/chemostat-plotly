//jshint esversion: 9

/* 
IMPORTANT COMMENTS / ISSUES:
1. data arrays need to be converted from objects to arrays (array = Object.values(array)) 
2. these arrays need to have elements converted from strings to numbers (array.map(Number))
3. plotly.js is not compatible with jQuery
4. to obtain mouse coordinates, use evt.offsetY / evt.offsetX  OR evt.layerY/evt.layerX--- VERY IMPORTANT!!!
5. 'biomassAndSubstrateK' is never used!!
6. Fix optimal D w/ recycle and X-axis scaling

*/

// Variables for calculations and X-axis

const DECIMAL_PLACES = 3;
const numOfPoints = 1000;

// Default values
var muMax = 0.6; // [1/h]
var constantOfSaturation = 0.2; // [kg/m^3]
var substrateInflowContentration = 15; // [kg/m^3]đ
var biomassYield = 0.5; // [kg/kg]

var useRecycle = false;
var recycleRatio = 0.15;
var concentrationFactor = 3;
//
// RUN SCRIPT
//

// Get inputs and set default values
var muMaxInput = document.getElementById("mu-max-input");
var constantOfSaturationInput = document.getElementById("const-saturation-input");
var substrateInflowContentrationInput = document.getElementById("subst-inflow-input");
var biomassYieldInput = document.getElementById("biomass-yield-input");



var useRecycleCheckbox = document.getElementById("use-recycle");
var recycleRatioInput = document.getElementById("recycle-ratio-input");
var concentrationFactorInput = document.getElementById("concentration-factor-input");

muMaxInput.value = muMax;
constantOfSaturationInput.value = constantOfSaturation;
substrateInflowContentrationInput.value = substrateInflowContentration;
biomassYieldInput.value = biomassYield;

useRecycleCheckbox.checked = useRecycle;
recycleRatioInput.value = recycleRatio;
concentrationFactorInput.value = concentrationFactor;

// Get checkboxes


// Set input "step"
muMaxInput.setAttribute("step", "0.1");
constantOfSaturationInput.setAttribute("step", "0.1");
biomassYieldInput.setAttribute("step", "0.1");

// biomassYieldInput.setAttribute("max", "1");

// Calculate data
var calculatedData = new ChemostatData(
    muMax,
    constantOfSaturation,
    substrateInflowContentration,
    biomassYield,
    useRecycle
);

// Plot div
var plotDiv = document.getElementById("chemostat-plot-div");
plotData(plotDiv, calculatedData);

// FUNCTIONS & OBJECTS

//ChemostatData object does NOT take 'numOfPoints' as a parameter!
function ChemostatData(muMax, constantOfSaturation, substrateInflowContentration, biomassYield, useRecycle) {
    // Init variables
    this.muMax = muMax;
    this.constantOfSaturation = constantOfSaturation;
    this.substrateInflowContentration = substrateInflowContentration;
    this.biomassYield = biomassYield;
    this.useRecycle = useRecycle;

    // Recycle
    if (useRecycle) {
        this.recycleParameters = calculateRecycleParameters();
    }

    // Calculate via declared functions
    this.dilutionRateArray = makedilutionRateArray(this.muMax, numOfPoints);
    this.substrateArray = makeSubstrateArray(this.muMax, this.dilutionRateArray, this.constantOfSaturation, this.substrateInflowContentration, this.useRecycle, this.recycleParameters);
    this.biomassArray = makeBiomassArray(this.muMax, this.dilutionRateArray, this.biomassYield, this.constantOfSaturation, this.substrateInflowContentration, this.useRecycle, this.recycleParameters);
    this.productivityArray = makeProductivityArray(this.muMax, this.dilutionRateArray, this.substrateInflowContentration, this.constantOfSaturation, this.biomassYield, this.useRecycle, this.recycleParameters);

    this.optimalDilutionRate = this.dilutionRateArray[this.productivityArray.indexOf(Math.max(...this.productivityArray))];

}

function makedilutionRateArray(muMax, numOfPoints) {
    // Get x axis maximum from muMax
    var xAxisMax = Math.floor(muMax) + 1.5;

    // Initialise x axis with dilutionRateArray
    var dilutionRateArray = []; // Init as empty array

    for (var i = 0; i <= numOfPoints * xAxisMax; i++) {
        let j = (1 / numOfPoints) * i;
        dilutionRateArray.push(j.toFixed(DECIMAL_PLACES));
    }

    dilutionRateArray = Object.values(dilutionRateArray); // To convert Object to Array ???
    dilutionRateArray = dilutionRateArray.map(Number);

    return dilutionRateArray;
}


// Substrate calculations (D...'dillution rate')
function makeSubstrateArray(
    muMax,
    dilutionRateArray,
    constantOfSaturation,
    substrateInflowContentration,
    useRecycle = false,
    recycleParameters = NaN
) {
    var substrateArray = new Array(dilutionRateArray.length);

    let substrateK = recycleParameters.productivityK; // K FOR RECYCLE
    let recycleRatio = recycleParameters.recycleRatio;
    let concentrationFactor = recycleParameters.concentrationFactor;

    if (useRecycle) {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);
            let s = (substrateK * D * constantOfSaturation) / (muMax - substrateK * D);
            let substrateCap = substrateInflowContentration + (substrateInflowContentration * recycleRatio) / concentrationFactor;
            if (s >= substrateCap) {
                substrateArray.fill(substrateCap, indexOfD);
                break;
            }
            substrateArray[indexOfD] = s;
        }
    } else {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);
            let s = (D * constantOfSaturation) / (muMax - D);
            if (s >= substrateInflowContentration) {
                substrateArray.fill(substrateInflowContentration, indexOfD);
                break;
            }
            substrateArray[indexOfD] = s;
        }
    }

    substrateArray = Object.values(substrateArray);
    substrateArray = substrateArray.map(Number);

    return substrateArray;
}

// Biomass calculations
function makeBiomassArray(
    muMax,
    dilutionRateArray,
    biomassYield,
    constantOfSaturation,
    substrateInflowContentration,
    useRecycle = false,
    recycleParameters = NaN
) {
    var biomassArray = new Array(dilutionRateArray.length);

    let biomassK = recycleParameters.productivityK;

    if (useRecycle) {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);

            let x = (biomassYield / biomassK) * (substrateInflowContentration - (biomassK * D * constantOfSaturation) / (muMax - biomassK * D));

            if (x <= 0) {
                biomassArray.fill(0, indexOfD);
                break;
            }
            biomassArray[indexOfD] = x;
        }
    } else {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);
            let x =
                biomassYield *
                (substrateInflowContentration - (D * constantOfSaturation) / (muMax - D));

            if (x <= 0) {
                biomassArray.fill(0, indexOfD);
                break;
            }
            biomassArray[indexOfD] = x;
        }
    }

    biomassArray = Object.values(biomassArray);
    biomassArray = biomassArray.map(Number);

    return biomassArray;
}

//Productivity calculations
function makeProductivityArray(muMax, dilutionRateArray, substrateInflowContentration, constantOfSaturation, biomassYield, useRecycle = false, recycleParameters = NaN) {
    var productivityArray = new Array(dilutionRateArray.length);

    let productivityK = recycleParameters.productivityK;

    if (useRecycle) {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);
            let q = biomassYield * (D * substrateInflowContentration - (D * D * constantOfSaturation) / ((muMax / productivityK) - D));
            if (q <= 0 && indexOfD != 0) {
                productivityArray.fill(0, indexOfD);
                break;
            }
            productivityArray[indexOfD] = q;
        }
    } else {
        for (let D of dilutionRateArray) {
            let indexOfD = dilutionRateArray.indexOf(D);
            let q = D * biomassYield * (substrateInflowContentration - (D * constantOfSaturation) / (muMax - D));
            if (q <= 0 && indexOfD != 0) {
                productivityArray.fill(0, indexOfD);
                break;
            }
            productivityArray[indexOfD] = q;
        }
    }

    return productivityArray;
}

// Calculate recycle k (for productivity and for S&X) SOURCE: http://ocw.snu.ac.kr/sites/default/files/NOTE/5599.pdf
function calculateRecycleParameters() {
    // Get inputs
    let recycleRatio = document.getElementById("recycle-ratio-input").value;
    let concentrationFactor = document.getElementById("concentration-factor-input").value;

    // Calculate k for S&X
    let biomassAndSubstrateK = 1 + recycleRatio - recycleRatio * concentrationFactor; // This is actually never used!!!

    // Calculate k for productivity
    let productivityK = 1 + recycleRatio * (1 - concentrationFactor);

    // Return all values
    return {
        recycleRatio: recycleRatio,
        concentrationFactor: concentrationFactor,
        biomassAndSubstrateK: biomassAndSubstrateK,
        productivityK: productivityK
    };
}

// Draw chart - using Plotly.js

function plotData(plotDiv, calculatedData) {
    // remove both event listeners for plotDiv - with jQuery
    $("#chemostat-plot-div").off("mousemove mouseout");

    // Create data traces
    var biomassTrace = {
        x: calculatedData.dilutionRateArray,
        y: calculatedData.biomassArray,
        type: "scatter",
        name: "Biomass (X)",
    };

    var substrateTrace = {
        x: calculatedData.dilutionRateArray,
        y: calculatedData.substrateArray,
        type: "scatter",
        name: "Substrate (S)",
        yaxis: "y2",
    };

    var productivityTrace = {
        x: calculatedData.dilutionRateArray,
        y: calculatedData.productivityArray,
        type: "Scatter",
        name: "Productivity (QX)",
        yaxis: "y3"
    };

    var data = [biomassTrace, substrateTrace, productivityTrace];


    // Create Layout
    var plotLayout = {
        title: "Chemostat",
        showlegend: true,
        xaxis: {
            title: "D [1/h]",
            anchor: "y",
            domain: [0, 0.9]
        },
        yaxis: {
            title: "X [kg/m^3]",
            anchor: "x"
        },
        yaxis2: {
            title: "S [kg/m^3]",
            overlaying: "y",
            side: "right",
        },
        yaxis3: {
            title: "QX [kg/(m^3*h)]",
            anchor: "free",
            overlaying: "y",
            side: "right",
            position: 0.95
        }
    };

    // Create config
    var plotConfig = {
        responsive: true,
    };


    // Create plot
    Plotly.newPlot(plotDiv, data, plotLayout, plotConfig);

    showCoordinates();
    showOpimalD();
}

// Display optimal dilution rate
function showOpimalD() {
    // Query paraghaph for optimal dilution rate
    var optimalD = $("#optimal-D");
    optimalD.text("Optimal D: ");

    // Display most productive dilution rate
    optimalDRate = calculatedData.optimalDilutionRate;
    optimalD.append(optimalDRate);
}

// Hover/mouse position tracking functionality to show and both y coordinates

function showCoordinates() {
    // Get HTML element to display mouse position in plot
    var hoverInfo = $("#hover-info");
    hoverInfo.text("D: | X: | S: | QX: ");

    // Get margins
    var xAxis = plotDiv._fullLayout.xaxis;
    var yAxis1 = plotDiv._fullLayout.yaxis;
    var yAxis2 = plotDiv._fullLayout.yaxis2;
    var yAxis3 = plotDiv._fullLayout.yaxis3;
    var l = plotDiv._fullLayout.margin.l;
    var t = plotDiv._fullLayout.margin.t;

    // Make array to store axis coordinates for later display

    plotDiv.addEventListener("mousemove", function (evt) {

        var xAxisCoord = xAxis.p2c(evt.offsetX - l);
        var yAxis1Coord = yAxis1.p2c(evt.offsetY - t);
        var yAxis2Coord = yAxis2.p2c(evt.offsetY - t);
        var yAxis3Coord = yAxis3.p2c(evt.offsetY - t);

        xAxisCoord = xAxisCoord.toFixed(3);
        yAxis1Coord = yAxis1Coord.toFixed(3);
        yAxis2Coord = yAxis2Coord.toFixed(3);
        yAxis3Coord = yAxis3Coord.toFixed(3);

        if (xAxisCoord >= 0 && yAxis1Coord >= 0 && yAxis2Coord >= 0 && yAxis3Coord >= 0) {
            hoverInfo.text(
                "D: " + xAxisCoord + " | X: " + yAxis1Coord + " | S: " + yAxis2Coord + " | QX: " + yAxis3Coord
            );
        }
    });

    plotDiv.addEventListener("mouseout", function (evt) {
        hoverInfo.text("D: | X: | S: | QX: ");
    });
}

document.addEventListener("resize", function (evt) {
    // remove both event listeners for plotDiv - with jQuery
    $("#chemostat-plot-div").off("mousemove mouseout");

    // add event listeners with showCoordinates function
    showCoordinates();
});

document.addEventListener("input", function (evt) {
    // remove both event listeners for plotDiv - with jQuery
    $("#chemostat-plot-div").off("mousemove mouseout");

    // jQuery for recycle inputs
    let recycleInputs = $(".recycle-input");


    // get inputs
    muMax = muMaxInput.value;
    constantOfSaturation = constantOfSaturationInput.value;
    substrateInflowContentration = substrateInflowContentrationInput.value;
    biomassYield = biomassYieldInput.value;

    // get checkboxes
    // calculateBiomass = calculateBiomassCheckbox.checked;
    // calculateSubstrate = calculateSubstrateCheckbox.checked;
    // calculateProductivity = calculateProductivityCheckbox.checked;
    useRecycle = useRecycleCheckbox.checked;


    // change inputs to floats
    muMax = parseFloat(muMax);
    constantOfSaturation = parseFloat(constantOfSaturation);
    substrateInflowContentration = parseFloat(substrateInflowContentration);
    biomassYield = parseFloat(biomassYield);

    // Recycle related conditionals
    if (useRecycle) {
        recycleInputs.css("visibility", "visible");
    } else {
        recycleInputs.css("visibility", "hidden");
    }


    // calculate data
    calculatedData = new ChemostatData(
        muMax,
        constantOfSaturation,
        substrateInflowContentration,
        biomassYield,
        useRecycle
    );


    plotData(plotDiv, calculatedData);
});

// #################################################