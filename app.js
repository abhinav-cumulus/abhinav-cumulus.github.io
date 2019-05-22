var width = window.innerWidth;
var height = window.innerHeight;
var color = d3.scaleOrdinal(d3.schemeCategory10);
var tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);
var maxNumOfSiblings = 7;
var node;
var fisheye = d3.fisheye.circular()
  .radius(100)
  .distortion(5);

var descBar = d3.select('#node-desc');
var closeBtn = descBar.select('#close');
var tierIcons = {
  5: 'ring.png',
  4: 'exit.png',
  3: 'core.png',
  2: 'dist.png',
  1: 'access.png',
  0: 'server.png',
};

closeBtn.on("click", () => descBar.style("display", "none"));

d3.select("run-btn").click = run;

function run() {
  document.getElementById("viz").innerHTML = '';
  let fileName = document.getElementById("json-select").value;
  let layoutType = document.getElementById("layout-select").value;
  let shortenNodes = document.getElementById("shorten-nodes-select").checked;
  let implementFisheye = document.getElementById("fisheye-select").checked;

  d3.json(fileName).then(function (data) {

    if(fileName == '2ea.json') {
      data.nodes.forEach(n => {
    
        switch(n.name.split('-')[0]) {
          case 'noc':
            n.tier = 3;
            break;
          case 'spine':
            n.tier = 5;
            break;
          case 'tor':
            n.tier = 3;
            break;
          case 'torc':
            n.tier = 3;
            break;
          case 'host':
            n.tier = 0;
            break;
          case 'firewall':
            n.tier = 1;
            break;
        }
      })
    }

    if(fileName == 'anil-topo.json') {
      data.nodes.forEach(node => {
        let name = node.name;
        if(name.search(/nqcb(.*)spine(.*)/i) !== -1) {
          node.tier = 5;
        } 
        else if(name.search(/nqcb(.*)leaf(.*)/i) !== -1) {
          node.tier = 4;
        }
        else if(name.search(/hosts-(.*)-(.*)/i) !== -1) {
          node.tier = 2;
        } 
        else if(name.search(/hosts-(.*)/i) !== -1) {
          node.tier = 3;
        } 
        console.log(name, node.tier)
      })
    }


    var graph = {};

    graph.nodes = data.nodes.map(n => ({ id: n.name, group: parseInt(n.tier), weight: parseInt(n.tier) + Math.random() * 0.25, data: { ...n } }));
    graph.links = data.links.map(l => ({ source: l.interfaces[0].node, target: l.interfaces[1].node, value: 1 }));

    nodesAtEachTier = [];

    graph.nodes.forEach(n => {
      nodesAtEachTier[n.group] = !nodesAtEachTier[n.group] ? 1 : nodesAtEachTier[n.group] + 1;
    });

    console.log(nodesAtEachTier);

    graph.nodes.forEach(n => {
      if(nodesAtEachTier[n.group] > 30) {
        n.hideLabel = true;
        n.shortenNodeSize = true;
      }
    });

    graph.links.forEach(l => {
      let source = graph.nodes.find(n => n.id === l.source);
      let target = graph.nodes.find(n => n.id === l.target);
      let parent, child;

      if (source.group > target.group) {
        parent = source;
        child = target
      } else if (source.group < target.group) {
        parent = target;
        child = source;
      }
      if (parent && child) {
        parent.numOfChildren = (parent.numOfChildren || 0) + 1;
        parent.children = (parent.children || []).concat(child.id);
        child.parents = (child.parents || []).concat(parent.id);
      }
    });

    // graph.nodes.forEach(n => console.log(n));

    // graph.nodes.forEach(node => {
    //   if (node.numOfChildren > 6 && shortenNodes) {
    //     node.children
    //       .map(id => graph.nodes.find(n => n.id == id))
    //       .forEach(n => {
    //         n.hideLabel = true;
    //         n.shortenNodeSize = true;
    //       });
    //   }
    // });



    // graph.nodes.forEach(function (d, i) {
    //   label.nodes.push({ node: d });
    //   label.nodes.push({ node: d });
    //   label.links.push({
    //     source: i * 2,
    //     target: i * 2 + 1
    //   });
    // });

    // var labelLayout = d3.forceSimulation(label.nodes)
    //   .force("charge", d3.forceManyBody().strength(-100))
    //   .force("link", d3.forceLink(label.links).distance(0).strength(2));

    selectiveGravity = () => {
      graph.nodes.forEach((d) => {
        d.y = height - d.weight * 100 - 100;
      })
    }

    let yForce;
    if (layoutType == 'Radial') {
      yForce = d3.forceY(height / 2).strength(1);
    } else if (layoutType == 'Hierarchical') {
      yForce = selectiveGravity;
    }

    graphLayout = d3.forceSimulation(graph.nodes)
      .force("charge", d3.forceManyBody().strength(-5000))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(1))
      .force("y", yForce)
      .force("link", d3.forceLink(graph.links).id(function (d) { return d.id; }).distance(50).strength(1))
      .on("tick", ticked);

    var adjlist = {};

    graph.links.forEach(function (d) {
      adjlist[d.source.index + "-" + d.target.index] = true;
      adjlist[d.target.index + "-" + d.source.index] = true;
    });

    function neigh(a, b) {
      return a == b || adjlist[a + "-" + b];
    }


    var svg = d3.select("#viz").attr("width", width).attr("height", height);
    var container = svg.append("g");

    svg.call(
      d3.zoom()
        .scaleExtent([.1, 4])
        .on("zoom", function (x) {
          container.attr("transform", d3.event.transform);
          if (d3.event.transform.k < 0.85) {
            hideLabels();
          } else {
            showLabels();
          }
        })
    );



    function hideLabels() {
      node.select('text').attr('display', 'none');
    }

    function showLabels() {
      node.select('text').attr('display', d => d.hideLabel ? 'none' : 'block');
    }

    var link = container.append("g").attr("class", "links")
      .selectAll("line")
      .data(graph.links)
      .enter()
      .append("line")
      .attr("stroke", "#aaa")
      .attr("stroke-width", "1px");

    node = container.append("g").attr("class", "nodes")
      .selectAll("g")
      .data(graph.nodes)
      .enter()
      .append("g")
      .attr("class", "node")

    node.append("circle")
      .attr("r", d => d.shortenNodeSize ? 5 : 15)
      //.attr("fill", d => color(d.group))
      .attr("fill", "#eee")
      .attr("stroke", "#999")
      .attr("stroke-width", 3)

    node.append("text")
      .attr("dx", -20)
      .attr("dy", -20)
      .text(d => d.id)
      .attr('display', d => d.hideLabel ? 'none' : 'block');

    node.append("image")
      .attr("xlink:href", d => '/img/' + tierIcons[d.group])
      .attr("x", -7)
      .attr("y", -7)
      .attr("width", d => 15)
      .attr("height", d => 15)
      .attr("display", d => d.hideLabel ? 'none' : 'block')
      ;

    // node

    //   .select('text')
    if (implementFisheye) {
      svg.on("mousemove", function () {
        console.log("mouse moving");
        fisheye.focus(d3.mouse(this));

        var mouseX = d3.mouse(this)[0];
        var mouseY = d3.mouse(this)[1];
        var r = fisheye.radius();

        // node
        //   .select("circle")
        //   .each(function (d) {
        //     // console.log(d);
        //     d.fisheye = fisheye(d);
        //   })
        //   .attr("cx", function (d) { return d.fisheye.x; })
        //   .attr("cy", function (d) { return d.fisheye.y; })
        //   .attr("r", function (d) { return d.fisheye.z * 20; });

        node
          .each(function (d) {
            // console.log(d);
            d.fisheye = fisheye(d);
          })
          .attr("transform", function (d) {
            return "translate(" + d.fisheye.x + "," + d.fisheye.y + ")";
          })
          .select("circle")
          .attr("r", function (d) {
            return d.fisheye.z * (d.shortenNodeSize ? 5 : 15);
          })
          ;

        link.attr("x1", function (d) { return d.source.fisheye.x; })
          .attr("y1", function (d) { return d.source.fisheye.y; })
          .attr("x2", function (d) { return d.target.fisheye.x; })
          .attr("y2", function (d) { return d.target.fisheye.y; });

      });
    } else {
      svg.on("mousemove", null);
    }

    // node.append("text")
    //   .text(d => d.id)
    //   .attr("text-anchor", "middle")
    //   .attr("transform", function (d) {
    //     return "translate(" + 15 + "," + 10 + ")";
    //   })

    //node.append("text").text(function (d, i) { return i % 2 == 0 ? "" : d.node.id; })


    node.on("mouseover", focus).on("mouseout", unfocus);

    // node.call(
    //     d3.drag()
    //         .on("start", dragstarted)
    //         .on("drag", dragged)
    //         .on("end", dragended)
    // );

    // var labelNode = container.append("g").attr("class", "labelNodes")
    //   .selectAll("text")
    //   .data(label.nodes)
    //   .enter()
    //   .append("text")
    //   .text(function (d, i) { return i % 2 == 0 ? "" : d.node.id; })
    //   .style("fill", "#555")
    //   .style("font-family", "Arial")
    //   .style("font-size", 12)
    //   .style("pointer-events", "none"); // to prevent mouseover/drag capture

    node.on("mouseover", focus).on("mouseout", unfocus);

    node.on("click", handleClick);

    function handleClick(curr) {

      node.select("circle").attr("stroke", d => d.id == curr.id ? "blue" : "#ddd");
      var htmlString = '';
      [
        "name",
        "os_name",
        "os_version",
        "tier",
        "asic_bw_port",
        "asic_model",
        "asic_vendor",
        "board_model",
        "board_vendor",
        "count_alarm",
        "count_debug",
        "count_info",
        "count_warning",
      ].forEach(key => htmlString += key.split('_')
        .map(w => `<b> ${w.charAt(0).toUpperCase() + w.slice(1)}:</b> ${curr.data[key]} </br>`)
        .join(' '));

      herirchicalData = '<h3>Parents</h3>';
      herirchicalData += curr.parents && curr.parents.map(p => `<div> - ${p} </div>`).join(' ');

      herirchicalData += '<h3>Children</h3>';
      herirchicalData += curr.children && curr.children.map(c => `<div> - ${c} </div>`).join(' ');


      d3.select('#node-desc').select("#details").html(htmlString + herirchicalData + '<br/>');
      descBar.style("display", "block");
    }

    function ticked() {

      node.call(updateNode);
      link.call(updateLink);

      // labelLayout.alphaTarget(0.3).restart();
      // labelNode.each(function (d, i) {
      //   if (i % 2 == 0) {
      //     d.x = d.node.x;
      //     d.y = d.node.y;
      //   } else {
      //     var b = this.getBBox();

      //     var diffX = d.x - d.node.x;
      //     var diffY = d.y - d.node.y;

      //     var dist = Math.sqrt(diffX * diffX + diffY * diffY);

      //     var shiftX = b.width * (diffX - dist) / (dist * 2);
      //     shiftX = Math.max(-b.width, Math.min(0, shiftX));
      //     var shiftY = 16;
      //     this.setAttribute("transform", "translate(" + shiftX + "," + shiftY + ")");
      //   }
      // });
      // labelNode.call(updateNode);

    }

    function fixna(x) {
      if (isFinite(x)) return x;
      return 0;
    }

    function focus(d) {
      var index = d3.select(d3.event.target).datum().index;
      node.style("opacity", function (o) {
        return neigh(index, o.index) ? 1 : 0.1;
      });
      // labelNode.attr("display", function (o) {
      //   return neigh(index, o.node.index) ? "block" : "none";
      // });
      link.style("opacity", function (o) {
        return o.source.index == index || o.target.index == index ? 1 : 0.1;
      });



    }

    function unfocus() {
      // labelNode.attr("display", "block");
      node.style("opacity", 1);
      link.style("opacity", 1);

    }

    function updateLink(link) {
      link.attr("x1", function (d) { return fixna(d.source.x); })
        .attr("y1", function (d) { return fixna(d.source.y); })
        .attr("x2", function (d) { return fixna(d.target.x); })
        .attr("y2", function (d) { return fixna(d.target.y); });
    }

    function updateNode(node) {
      node.attr("transform", function (d) {
        return "translate(" + fixna(d.x) + "," + fixna(d.y) + ")";
      });
    }

    function dragstarted(d) {
      // console.log('started')
      d3.event.sourceEvent.stopPropagation();
      if (!d3.event.active) graphLayout.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) graphLayout.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }); // d3.json
}


//d3.json("sample-topology-ring.json").then(function (data) {
