let div = d3.select('.selection')
    .selectAll('.item')
    .data(['blue', 'green', 'purple']);


    div.style('background-color', d => d)
    .enter()
    .append('div')
    .classed('item', true)
    .text((d, i) => i + 1)
    .transition()
    .duration(5000)
    .style('background-color', d => d)
    
    // div.exit().remove()