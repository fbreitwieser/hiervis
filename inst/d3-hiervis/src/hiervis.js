function hiervis(svg, data, opts) {
    return new HierVis(svg, data, opts);
};

const makeid = function(n) {
    'use strict';
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let i = 0;
    for (i = 0; i < n; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


const setData = function(data, opts) {
    'use strict';
    let root;
    if (opts.krakenFile) {
        const parentAtDepth = Array(100).fill("")
        if (! data[1]) {
            throw new Error("ERROR - no data.");
        }
        if (! data[1].taxName) {
            throw new Error("Doesn't seem to be a KrakenHLL report - required columns are not present.");
        }

        data.forEach(d => {
            d.depth = (d.taxName.search(/\S/))/2;
            if (d.depth === -1)
                d.depth = 0;
            d.name = d.taxName.replace(/^\s*/, "");
            d.name = d.name.replace(/\|/g,"_")
            if (d.depth > 0) {
                d.path = parentAtDepth[d.depth - 1] + "|" + d.name;
            } else {
                d.path = d.name;
            }
            parentAtDepth[d.depth] = d.path;
        })
        data = data.filter(d => d.path.startsWith("root"))
        opts.pathSep = "|";
        opts.nameField = "path";
        opts.valueField = "taxReads";
        opts.stat = "sum";
    }
    if (opts.pathSep) {
        if (opts.parentField) {
            console.error("ERROR: pathSep and parentField cannot be used together.");
        }
        root = d3.stratify()
                     .id(d => d[opts.nameField])
                     .parentId(d => {
            const pos = d[opts.nameField].lastIndexOf(opts.pathSep);
            d.parentId = d[opts.nameField].substring(0, pos);
            if (opts.clipPath) {
                if (pos < d[opts.nameField].length)
                  d[opts.nameField] = d[opts.nameField].substr(pos + 1);
            }
            return d.parentId;
        })(data);

    } else if (opts.parentField) {
        root = d3.stratify()
                     .id(d => d[opts.nameField])
                     .parentId(d => d[opts.parentField])(data);
    } else {
        root = d3.hierarchy(data);
    }

    if (opts.simplifyPath) {
        const removeUselessNode = function(node, negative_depth) {
            node.depth -= negative_depth;
            if (!node.children) { return; }
            if (node.parent &&
                node.children.length === 1 &&
                node.parent.children.length === 1 &&
                node.value === node.parent.value) {

                node.children[0].parent = node.parent;
                node.parent.children[0] = node.children[0];
                negative_depth++
                node.depth -= 1;
            }
            let max_depth = node.depth;
            node.children.forEach(d => {
                const depth = removeUselessNode(d, negative_depth);
                if (depth > max_depth)
                    max_depth = depth;
            })
            node.height = max_depth;
            return max_depth;
        }
        removeUselessNode(root, 0);
        // TODO: Fix height
    }

    if (opts.treeColors) {
        const tcol = TreeColors(opts.treeColors);
        //tcol.luminanceDelta = -20;
        tcol(root)
    }

    switch(opts.stat) {
        case "sum":
            root.sum(d => typeof d[opts.valueField] !== undefined? d[opts.valueField] : 0);
            break;
        case "count":
            root.count();
            break;
        default: //identity by default
            // TODO: Is this necessary when valueField is 'value',
            //       or does d3.hierachy() copy it over?
            root.each(node => { node.value = node.data[opts.valueField] });
            root.value = d3.sum(root.children, d => d.value);
            break;
    }
    root.data[opts.nameField] = opts.rootName;    
    return root;
}

const defaults = {
    vis: "sankey",
    rootName: "root",
    width: "100vw", // 100% viewport width
    height: "100vh", // 100% viewport height
    nameField: "name",
    valueField: "value",
    colorField: null,
    stat: "identity",  // possible choices: identity, sum, and count
    buttons: false, // show buttons to switch layout
    transitionDuration: 350,
    numberFormat: ",d",
    // General options
    showNumbers: true,
    treeColors: true,
    krakenFile: false,
    simplifyPath: true, // Remove nodes without a value, and only one child
    // Treemap options
    treemapHier: true,
    // Sunburst options
    sunburstLabelsRadiate: false,
    circleNumberFormat: ".2s",
    // Sankey options
    linkColorChild: false,  // it true, color links based on child, not the parent
    sankeyMinHeight: null,  // if numeric, labels are only displayed when the node is above the value
    // Stratify options
    parentField: null,     // field for parent when using stratify
    pathSep: "/",          // Use separator on nameField to get name and parent when using stratify
    clipPath: true         // Set name to the last part of path. When false, the name is the full path
  };

//const visualizations = [ "icicle", "treemap", "partition", "pack", "sunburst", "sankey" ];
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

class HierVis {
/*  let opts, element, root, svg, ID;
  let width, height, maxRadius;
  let formatNumber, formatCircleNumber; */

  constructor(svg, data, o) {
    this.opts = Object.assign({}, defaults);
    this.opts['id'] = makeid(5);
    for (let opt in o) {
      if (typeof(this.opts[opt]) === "undefined") {
        console.error("ERROR: Ignoring unknown option "+opt)
      } else {
        this.opts[opt] = o[opt];
      }
    }
    this.ID = this.opts['id']
    this.formatNumber = d3.format(this.opts.numberFormat);
    this.formatCircleNumber = d3.format(this.opts.circleNumberFormat);

    // Compute d3 hierachy root based on data
    this.root = setData(data, this.opts);
    this.root.value = 0;
    this.root.children.forEach(d => this.root.value += d.value);
    this.root_sav = this.root;

    this.svg = svg;

  }

  set vis(value) {
      this.opts.vis = value;
  }
    
  filter(val, txt_regex) {
      const self = this;
      let changed_nodes = 0;
      if (txt_regex.match(/\|$/)) {
          txt_regex = txt_regex.slice(0, -1);
      }
      const re = new RegExp("^"+txt_regex+"$");
      
      this.root.each(d => {
          if (!d.original_value) {
              d.original_value = d.value
          } else {
              d.value = d.original_value
          }
      });
      
      if (!val) {
          val = 0;
      }
      
      const updateParentsVal = function(parent, val) {
          parent.value -= val
          if (parent.parent) {
              updateParentsVal(parent.parent, val)
          }
      }
      
      const filterMinRec = function(node, val, txt_regex) {
          if (node.children || node.children_sav) {
              if (!node.children_sav) {
                node.children_sav = node.children;
              }
              
              const children_new = []
              for (let i=0; i<node.children_sav.length; i++) {
                  const child = node.children_sav[i];
                  
                  const re_match = child.data[self.opts.nameField].match(re) != null
                  if (child.value >= val && !re_match) {
                      children_new.push(child)
                      filterMinRec(child, val, txt_regex)
                  } else {
                      if (re_match) {
                          // Update parents by removing the values
                          updateParentsVal(node, child.value)
                      }
                      changed_nodes += 1
                  }
              }
              node.children = children_new;
          }
      }
      
      filterMinRec(this.root, val);
      
      if (changed_nodes > 0) 
        self.draw();
  }
    
    

  draw(vis = null) {
    if (!vis) {
        vis = this.opts.vis;
    } else {
        this.opts.vis = vis
    }
    if (!vis) {
        console.error("Provide vis");
    }


    // append SVG here, instead of selecting it in the constructor?
    //const g = this.svg.selectAll("g");
    //g.remove();
    // Get width and height through bounding box
    const rectBB = this.svg.append('rect').attr("width", "100%").attr("height", "100%");
    const boundingBox = rectBB.node().getBBox();
    this.width = boundingBox.width;
    this.height = boundingBox.height;
    rectBB.remove();
    this.maxRadius = Math.min(this.width, this.height)/3;
    this.svg.selectAll("*").remove();
    this.svg.attr('viewBox', null);

    // Set CSS styles
    this.svg.append("style").text(`
.slice { cursor: pointer; }
.slice .main-arc { stroke: #fff; stroke-width: 1px; }
.slice .hidden-arc { fill: none; }
.slice text { pointer-events: none; /*dominant-baseline: middle;*/ text-anchor: middle; }
.slice .text-countour { fill: none; stroke: #fff; stroke-width: 5; stroke-linejoin: round; }
text { padding: 5px; font: 12px sans-serif; }
g.partition g rect { stroke: #fff; opacity: .5; }
g.sankey g path { opacity: .5; }
g.rects g rect { stroke: #fff; }
g.links path { stroke: #fff; opacity: 0.7; }

g.labels text {
  cursor: pointer;
  text-anchor: start;
  /*dominant-baseline: hanging; not working in Safari*/
}
g.labels text tspan {
  font: 10px sans-serif;
}
g.slice text textPath tspan {
  font: 10px sans-serif;
}
g.labels.sankey.vertical text { text-anchor: middle; }
g.labels.sankey.horizontal text { /* dominant-baseline: middle; not working in Safari*/ }

/* for cluster dendrogram */
.node circle {
  fill: #999;
}
.node--internal circle {
  fill: #555;
}

.node--internal text {
  text-shadow: 0 1px 0 #fff, 0 -1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff;
}

.link {
  fill: none;
  stroke: #555;
  stroke-opacity: 0.4;
  stroke-width: 1.5px;
}

`);

    switch(vis) {
      case "icicle":
        this.icicle();
        break;
      case "treemap":
        this.treemap();
        break;
      case "partition":
        this.partition();
        break;
      case "pack":
        this.pack();
        break;
      case "sankey":
        this.sankey();
        break;
      case "vertical sankey":
        this.vertical_sankey();
        break;
      case "tree":
        this.tree();
        break;
      case "cluster":
        this.cluster();
        break;
      case "cycle":
        this.cycle();
        break;
      case "sunburst":
      default:
        this.sunburst();
        break;
    }
    //if (!visualizations.indexOf(vis) >= 0) {
    //  console.log("Don't know visualization " + vis + " - showing Sankey");
    //}
  }
    
  cycle() {
      for (let i = 1; 1 < 1000; ++i) {
          ["icicle", "treemap", "partition", "sankey", "cluster", "sunburst", "vertical sankey"].forEach(vis1 => {
              setTimeout(() => draw(vis1), 1000)
          })
      }
  }

  pack() {
    // from Bostock - Zoomable circle packing
/*
    const margin = 20,
        diameter = this.width


    const pack1 = this.svg.append("g")
                  .attr("transform", "translate("+diameter/2+","+diameter/2+")")

    const pack = d3.pack().size([diameter, diameter]).padding(2);

    const circle = pack1.selectAll("circle")
                  .data(pack(this.root).descendants())
                  .enter().append("circle")
                  .style("fill", d => this._color(d))
                  */
      //todo
  }

  treemap() {
    // Make it look nicer - see ganeshv's block
    this.icicle(false, true)
  }

  partition() {
    this.icicle(true);
  }

  sankey() {
    this.icicle(true, false, true)
  }

  vertical_sankey() {
    this.icicle(false, false, true)
  }

  icicle(horizontal=false, is_treemap=false, is_sankey=false) {
    const self = this;
    const sankeyNodeSize = 10;
    const sankeyNodeDist = 2;
    const textPadding = 1;

    const x0 = horizontal? "y0" : "x0",
          x1 = horizontal? "y1" : "x1",
          y0 = horizontal? "x0" : "y0",
          y1 = horizontal? "x1" : "y1";

    const xx = horizontal? "y" : "x";
    const yy = horizontal? "x" : "y";

    let nodes;
      
    // pads Sankey nodes - expects global 'max_dy1' and 'max_fact' variables
    const padNodes = function(d, delta, y0, y1) {
              const y1_b4 = d[y1];
              if (d.children) {
                  const delta_start = delta;
                  let children_max_y1 = 0
                  d.children.forEach((e, i) => {
                      delta = padNodes(e, delta, y0, y1)
                      if (e[y1] > children_max_y1) {
                          children_max_y1 = e[y1]
                      }
                      delta = delta + sankeyNodeDist;
                  })

                  // Save the minimum y0 and maximum y1 for zooming purposes
                  d.children_min_y0 = d[y0] + delta_start
                  d.children_max_y1 = Math.max(d[y1] + delta_start, children_max_y1)

                  // Set parent at the middle
                  const shift_delta = (delta_start + delta)/2
                  if (children_max_y1 > d[y1] + delta_start) {
                    d[y0] += shift_delta;
                    d[y1] += shift_delta;
                  } else {
                    d[y0] += delta_start;
                    d[y1] += delta_start;
                    delta = delta_start;
                  }
              } else {
                  d[y0] += delta
                  d[y1] += delta
                  d.children_min_y0 = d[y0]
                  d.children_max_y1 = d[y1]
              }
              if (d[y1] > max_dy1) {
                      max_dy1 = d[y1]
                      max_fact = max_dy1 / y1_b4;
              }
              return delta;
          }

    if (is_treemap) {
      const treemap = d3.treemap()
                      .tile(d3.treemapResquarify)
                      .size([this.width, this.height])
                      .round(true)
                      .paddingInner(1);
      treemap(this.root);
      nodes = this.root.leaves()
    } else {
      const partition = d3.partition()
                        .padding(0)
                        .round(false);

      let scale_factor = 1;
      if (is_sankey) {
          let max_depth = 1;
          this.root.each(d => {
            if (d.depth > max_depth) {
               max_depth = d.depth;
            }
            scale_factor = max_depth / (max_depth + 1)

        })
      }
      if (horizontal) {
        partition.size([this.height, this.width * scale_factor])
      } else {
        partition.size([this.width, this.height * scale_factor])
      }

      partition(this.root);

      if (is_sankey) {
          // variables that are modified by padNodes
          var max_fact = 1, max_dy1 = 0;

          padNodes(this.root, 0, "x0", "x1")

          // Scale the sizes to fit the window
          this.root.each(d => {
              d["x0_orig"] = d["x0"]
              d["x1_orig"] = d["x1"]
              d["x0"] /= max_fact
              d["x1"] /= max_fact
              d.children_min_y0 /= max_fact
              d.children_max_y1 /= max_fact
          })
      }
        
      nodes = this.root.descendants();

      nodes.forEach((d, i) => {
        d.w = d[x1] - d[x0];
        d.h = d[y1] - d[y0];
        if (d.parent) {
          d.parent.children_x0s = 0;
          d.parent.children_y0s = 0;
        }
        d._unique_id = i;
      })
      if (is_sankey) {
        nodes.forEach(d => {
          if (d.parent) {
            d.sibling_x0s = (d.parent.children_x0s || 0);
            d.sibling_y0s = (d.parent.children_y0s || 0);
            d.parent.children_x0s = (d.parent.children_x0s || 0) + d.w
            d.parent.children_y0s = (d.parent.children_y0s || 0) + d.h
          }
        })

      }
    }

    const x = d3.scaleLinear()
                .range([0, this.width]);
    const y = d3.scaleLinear()
                .range([0, this.height]);

    const icicle1 = this.svg.append("g")
                          .attr("class", is_sankey? "sankey" : "partition");
    const icicle = icicle1.selectAll("g")
                    .data(nodes).enter().append("g")

    // Have labels separate so that they are rendered last
    const texts1 = this.svg.append("g")
                          .attr("class", "labels"
                                         + (is_sankey? " sankey" : " partition")
                                         + (horizontal? " horizontal" : " vertical"));
    const texts = texts1.selectAll("text")
                    .data(nodes).enter().append("text")

    const set_texts = function(selection, x, y) {
        if (is_sankey) {
             selection
                 .attr("x", d => !horizontal? x((d[x0]+d[x1])/2)  : x(d[x0]) + sankeyNodeSize + textPadding )
                 .attr("y", d => horizontal? y((d[y0]+d[y1])/2) : y(d[y0]) + sankeyNodeSize + textPadding)
        } else {
          selection
           .attr("x", d => x(d[x0]) + textPadding)
           .attr("y", d => y(d[y0]) + textPadding)
        }
    };

    const set_tspans = function(selection, x, y) {
        if (is_sankey) {
            selection.attr("x", d => !horizontal? x((d[x0]+d[x1])/2)  : x(d[x0]) + sankeyNodeSize + textPadding )
        } else {
            selection.attr("x", d => x(d[x0]) + textPadding )
        }
    };

    const rects = function(selection, x, y) {
        if (is_sankey) {
            sankey_rects(selection, x, y)
        } else {
            partition_rects(selection, x, y)
        }
    };

    const partition_rects = function(selection, x, y) {
       selection.attr("x", d => x(d[x0]) )
           .attr("y", d => y(d[y0]) )
           .attr("width", d => x(d[x1]) - x(d[x0]))
           .attr("height", d => y(d[y1]) - y(d[y0]))
    };

    const sankey_clip_rects = function(selection, x, y) {
       if (horizontal) {
       selection.attr("x", d => x(d[x0]) )
           .attr("y", d => y(d.children_min_y0 - sankeyNodeDist/4))
           .attr("width", d => x(d[x1]) - x(d[x0]))
           .attr("height", d => y(d.children_max_y1 + sankeyNodeDist/2) - y(d.children_min_y0))
       } else {
       selection
           .attr("x", d => x(d.children_min_y0 - sankeyNodeDist/4))
           .attr("y", d => y(d[y0]) )
           .attr("height", d => y(d[y1]) - y(d[y0]))
           .attr("width", d => x(d.children_max_y1 + sankeyNodeDist/2) - x(d.children_min_y0))
       }
    };

    const sankey_rects = function(selection, x, y) {
        selection.attr("x", d => x( d[x0] ))
            .attr("y", d => y( d[y0] ))
            .attr("visibility", null)
            .attr("width", d => horizontal? sankeyNodeSize : x(d[x1]) - x(d[x0]))
            .attr("height", d => !horizontal? sankeyNodeSize : y(d[y1]) - y(d[y0]))
    }

    const parent_rect = function(selection, x, y) {
        // Center the parent rectangle on the left side
        selection.attr("x", d => !horizontal? Math.max(0, (self.width - x(d[x1]) + x(d[x0]))/2) : 0)
              .attr("y", d => horizontal? Math.max(0, (self.height - y(d[y1]) + y(d[y0]))/2) : 0)
    }
    
        const clicked = function(d) {
      if (horizontal) {
        let min_x = d.depth? self.width / 10 : 0;
        if (d.parent && d[x0] - d.parent[x0] < min_x) {
          min_x = d[x0] - d.parent[x0];
        }

        x.domain([d[x0], self.width]).range([min_x, self.width]);
        if (is_sankey) {
            y.domain([d.children_min_y0, d.children_max_y1])
        } else {
          y.domain([d[y0], d[y1]]);
        }
      } else {
        let min_y = d.depth? self.height / 10 : 0;
        if (d.parent && d[y0] - d.parent[y0] < min_y) {
          min_y = d[y0] - d.parent[y0];
        }

        if (is_sankey && !horizontal) {
            x.domain([d.children_min_y0, d.children_max_y1])
        } else {
            x.domain([d[x0], d[x1]]);
        }
        y.domain([d[y0], self.height]).range([min_y, self.height]);
      }

      if (is_sankey) {
          clip_rect.transition()
            .duration(self.opts.transitionDuration)
             .call(sankey_clip_rects, x, y)

          links.transition()
                .duration(self.opts.transitionDuration)
                .call(link_me, x, y)
                .filter(d1 => d1.depth <= d.depth)
                .attr("visibility", "hidden")
      }

       rect.transition()
              .duration(self.opts.transitionDuration)
              .call(rects, x, y)
              .filter(d1 => d1 === d.parent).call(parent_rect, x, y)

       text.transition()
           .duration(self.opts.transitionDuration)
           .call(set_texts, x, y)

      if (self.opts.showNumbers)
          tspan.transition()
               .duration(self.opts.transitionDuration)
               .call(set_tspans, x, y)
    }


    // the objects containing the elements
    let links, clip_rect, rect, text, tspan;

    const horizontal_links = function(selection, x, y) {
      const lh = d3.linkHorizontal();
      selection
        .attr("visibility", null)
        .attr('d', d => {
         if (d.parent) {
           return [ lh({source: [x(d.parent[x0]) + sankeyNodeSize + 1, y(d.parent[y0] + d.sibling_y0s)],
                        target: [x(d[x0]) - 1, y(d[y0])]}),
             [ x(d[x0]) - 1, y(d[y0] + d.h)],
             lh({ source: [ x(d[x0]) - 1, y(d[y0] + d.h) ],
                  target: [ x(d.parent[x0]) + sankeyNodeSize + 1,
                            y(d.parent[y0] + d.sibling_y0s + d.h) ] }).slice(1)
            ].join(" L "); }})
    }

    const vertical_links = function(selection, x, y) {
      const lv = d3.linkVertical();
      selection
        .attr("visibility", null)
        .attr('d', d => {
         if (d.parent) {
           return [ lv({source: [ x(d.parent[x0] + d.sibling_x0s), y(d.parent[y0]) + sankeyNodeSize + 1],
                        target: [ x(d[x0]), y(d[y0]) - 1]}),
             [ x(d[x0] + d.w), y(d[y0]) - 1],
             lv({ source: [ x(d[x0] + d.w), y(d[y0]) -1 ],
                  target: [ x(d.parent[x0] + d.sibling_x0s + d.w),
                            y(d.parent[y0]) + sankeyNodeSize + 1 ] }).slice(1)
            ].join(" L ");}})
    }

    const link_me = horizontal? horizontal_links : vertical_links

    if (is_sankey) {
      clip_rect = icicle.append("clipPath")
          .attr("id", (d, i) => "clip-" + i + self.ID)
          .append("rect")
          .call(sankey_clip_rects, x => x, y => y);

      // add Sankey rects
      rect = icicle.append("rect")
                   .call(sankey_rects, x => x, y => y);

      // add Sankey links
      links = icicle.append('path')
                    .style('fill', d => self._color(d))
                    .call(link_me, x => x, y => y);
    } else {
      rect = icicle.append("rect")
               .attr("id", (_, i) => "rect-" + i + self.ID)
               .call(rects, x => x, y => y)

      icicle.append("clipPath")
          .attr("id", (d, i) => "clip-" + i + self.ID)
          .append("use")
          .attr("xlink:href", (_, i) => "#rect-" + i + self.ID);
    }

    text = texts.attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
                .call(set_texts, x => x, y => y)
                .on("click", clicked)
                .text(d => d.data[this.opts.nameField]);

     if (!(is_sankey && horizontal))
        text.attr("dy", "1em");

/*    if (is_sankey) {
        text
            .filter(d => d.children_max_y1 - d.children_min_y0 < 10)
            .attr("visibility", "hidden")
    }*/

    if (this.opts.showNumbers)
        tspan = text.append("tspan")
            .attr("dy", "1em")
            .call(set_tspans, x => x, y => y)
            .text(d => this.formatCircleNumber(d.value));

    text.append('title')
           .text(d => d.data[this.opts.nameField] + '\n' + this.formatNumber(d.value));

    rect.attr('fill', d => this._color(is_treemap && !this.opts.treeColors? d.parent : d))
        .style("cursor", "pointer")
        .on("click", clicked)
        .append('title')
        .text(d => d.data[this.opts.nameField] + '\n' + this.formatNumber(d.value));

  }

  tree() {
    const treeLayout = d3.tree();
    treeLayout(this.root);
  };

  cluster() {
    const self = this;

    const cluster = this.svg.append("g");
    const tree = d3.tree().size([this.height, this.width]);
    tree(this.root);

    const link = cluster.selectAll(".link")
                   .data(this.root.descendants().slice(1))
                   .enter().append("path").attr("class", "link")
                   .attr("d", d =>
                       `M${d.y},${d.x}C${d.parent.y + 100},${d.x} ${d.parent.y + 100},${d.parent.x} ${d.parent.y},${d.parent.x}`
                   );
    const node = cluster.selectAll(".node")
                   .data(this.root.descendants())
                   .enter().append("g")
                   .attr("class", d => "node " + (d.children? "node--internal" : "node--leaf"))
                   .attr("transform", d => "translate(" + d.y + "," + d.x + ")" )

    node.append("circle").attr("r", 2.5);
    node.append("text")
        .attr("dy", 3)
        .attr("x", d => d.children? -8 : 8)
        .style("text-anchor", d => d.children? "end" : "start")
        .text(d => d.id)
  }

  sunburst() {
    const self = this;
    const partition = d3.partition();
    partition(this.root);
    const nodes = this.root.descendants();

    this.svg.attr('viewBox', `${-this.width / 2} ${-this.height / 2} ${this.width} ${this.height}`);
    this.svg.on('click', () => sankeyClicked()); // Reset zoom on canvas click
    const x = d3.scaleLinear()
                .range([0, 2 * Math.PI])
                .clamp(true);

    const y = d3.scaleSqrt()
                .range([this.maxRadius*.1, this.maxRadius]);

    const arc = d3.arc()
              .startAngle(d => x(d.x0))
              .endAngle(d => x(d.x1))
              .innerRadius(d => Math.max(0, y(d.y0)))
              .outerRadius(d => Math.max(0, y(d.y1)));

    const middleArcLine = d => {
      const halfPi = Math.PI/2;
      const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
      const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

      const middleAngle = (angles[1] + angles[0]) / 2;
      const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
      if (invertDirection) { angles.reverse(); }

      const path = d3.path();
      path.arc(0, 0, r, angles[0], angles[1], invertDirection);
      return path.toString();
    };

    const slice = this.svg.selectAll('.slice.' + self.ID).data(nodes);
    slice.exit().remove();

    const newSlice = slice.enter()
                          .append('g').attr('class', 'slice ' + self.ID)
                          .on('click', d => {
                            d3.event.stopPropagation();
                            sankeyClicked(d);
                      });

    newSlice.append('title')
            .text(d => d.data[this.opts.nameField] + '\n' + this.formatNumber(d.value));

    newSlice.append('path')
            .attr('id', (_, i) => "mainArc-" + i + self.ID)
            .attr('class', 'main-arc ' + self.ID)
            .style('fill', d => this._color(d))
            .attr('d', arc);

    newSlice.append("clipPath")
            .attr("id", (_, i) => "clip-" + i + self.ID)
            .append("use")
            .attr("xlink:href", (_, i) => "#mainArc-" + i + self.ID);

    newSlice.append('path')
            .attr('class', 'hidden-arc ' + self.ID)
            .attr('id', (_, i) => "hiddenArc-" + i + self.ID)
            .attr('d', middleArcLine);

    const text = newSlice.append('text');
    if (this.opts.sunburstContour) {
      // Add white contour
      text.append('textPath')
          .attr('startOffset','50%')
          .attr('xlink:href', (_, i) => "#hiddenArc-" + i + self.ID )
          .text(d => d.data[this.opts.nameField])
          .attr('class', 'text-contour');
    }

    if (this.opts.sunburstLabelsRadiate) {
      // TODO: fix that -  doesn't work well, yet
      text
        //.attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
        // clip-path doesn't work
        .attr("transform", (d) => {
          const angle = (x(d.x0) + x(d.x1))*90/Math.PI - 90
          const res= "translate("+arc.centroid(d)+")rotate("+ ((angle > 90 || angle < -90)? angle - 180 : angle) +")"
          return res;
        })
        .text(d => d.data[this.opts.nameField]);
    } else {
      const text2 = text
        .attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
        .append('textPath')
        .attr('startOffset','50%')
        .attr('xlink:href', (_, i) => "#hiddenArc-" + i + self.ID )
        .text(d => d.data[this.opts.nameField]);

        if(this.opts.showNumbers)
          text2.append("tspan")
              .attr('x','0')
              .attr("dy", "1em")
              .text(d => self.formatCircleNumber(d.value));
    }


    const sankeyClicked = function(d = { x0: 0, x1: 1, y0: 0, y1: 1 }) {
        // Reset to top-level if no data point specified
      if (!d.children)
        return;
      const transition = self.svg.transition()
                            .duration(self.opts.transitionDuration)
                            .tween('scale', () => {
                              const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                                    yd = d3.interpolate(y.domain(), [d.y0, 1]);
                              return t => { x.domain(xd(t)); y.domain(yd(t)); };
                            });

      transition.selectAll('path.main-arc.' + self.ID)
                .attrTween('d', d => () => arc(d));

      transition.selectAll('path.hidden-arc.' + self.ID)
                .attrTween('d', d => () => middleArcLine(d));

      moveStackToFront(d);


      const moveStackToFront = function(elD) {
        self.svg.selectAll('.slice.' + self.ID).filter(d => d === elD)
                               .each(d => {
                                 this.parentNode.appendChild(this);
                                 if (d.parent) { moveStackToFront(d.parent); }
                               })
      }
    }
    /*
    function computeTextRotation(d) {
      return ((d.x0 + d.x1)/2 - Math.PI / 2) / Math.PI * 180;
    }*/
  }

  _color(d) {
    if (this.opts.treeColors) {
      return d3.hcl(d.color.h, d.color.c, d.color.l);
    } else if (this.opts.colorField) {
      return d.data[this.opts.colorField];
    }
    return(colorScale(d.data[this.opts.nameField]) || "gray");
    /*else if (d.children) {
      return d3.rgb(colorScale(d.data.name)).brighter(d.depth/5);
    } else {
      return d3.rgb(colorScale(d.parent.data.name)).brighter(d.depth/5);
    } */
  }
}

