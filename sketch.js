/*
    Get 0 column in csv, country name
    get 2 column in csv, ladder score
    show text for each country
    show happiness score in the circle
    use ai to make it cool
*/

let table;


async function setup() {
  createCanvas(windowWidth, windowHeight);
  table = await loadTable('/Data/World-happiness-report-2024.csv', ',', 'header');
  console.log(table);

  country = table.getColumn(0);
  happiness = table.getColumn(2);
}

function draw() {
  background(220);

  if(table)
  {
    for(let i = 0; i < table.getRowCount(); i++)
    {
        let textX = random(width);
        let textY = random(height);
        let scale = width * 0.01;

        //noStroke();
        fill(255);
        circle(textX, textY, happiness[i] * scale);

        textAlign(CENTER, CENTER);
        fill(0)
        text(country[i]), textX, textY;
    }
  }
  
  noLoop();
}

/*
    Please edit my code so that theh text shows up in the center of each circle. Each circle should be the colors of the national flag of the country it represents. You can use an API to get the flag colors based on the country name. Make sure to handle cases where the country name might not match perfectly with the API's database. Make sure none of the circles overlap each other, and that the text is clearly visible against the circle's background color. You can also add a tooltip that shows the exact happiness score when hovering over each circle. The circles should be in a grid layout to ensure they do not overlap, and the size of each circle should be proportional to the happiness score. Additionally, you can add a legend that explains the color coding of the circles based on the happiness score ranges. When hovered over, the circle should be a bit larger t0 show that it is being interacted with, and the tooltip should appear next to the cursor. You can also add a title and labels to make the visualization more informative. Make sure to test your code with different screen sizes to ensure it is responsive and looks good on all devices.

*/