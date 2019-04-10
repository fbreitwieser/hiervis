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
        if (!data[1]) {
            throw new Error("ERROR - no data.");
        }
        if (!data[1].taxName) {
            throw new Error("Doesn't seem to be a KrakenHLL report - required columns are not present.");
        }

        data.forEach(d => {
            d.depth = (d.taxName.search(/\S/)) / 2;
            if (d.depth === -1)
                d.depth = 0;
            d.name = d.taxName.replace(/^\s*/, "");
            d.name = d.name.replace(/\|/g, "_")
          
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
        //opts.valueField = "reads";
        //opts.stat = "identity";
        opts.valueField = "taxReads";
        opts.stat = "sum";
    }
    if (opts.pathSep) {
        if (opts.parentField) {
            console.error("ERROR: pathSep and parentField cannot be used together.");
        }

        /*
                var tree_res = ["root" = {name: "root", children: [], depth: 0}];
                data.forEach(function(d) {

                  row.ancestorIds = d[opts.nameField].split("/");
                });

                root = d3.hierarchy(burrow(data));
        */

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

    ["nameField", "valueField"].forEach(prop => {
        if (!root.children[0].data.hasOwnProperty(opts[prop])) {
            console.log("Data doesn't have property "+opts[prop]+"!")
            console.log(root)
        }
    })

    switch (opts.stat) {
        case "sum":
            root.sum(d => typeof d[opts.valueField] !== undefined ? d[opts.valueField] : 0);
            break;
        case "count":
            root.count();
            break;
        default: //identity by default
            // TODO: Is this necessary when valueField is 'value',
            //       or does d3.hierachy() copy it over?
            if (opts.valueField !== "value") {
                root.each(d => {
                    d.value = d.data[opts.valueField]
                });
            }
            root.value = d3.sum(root.children, d => d.value);
            break;
    }

    if (opts.simplifyPath && opts.krakenFile) {
        const ranks = ['superkingdom', 'phylum', 'family', 'genus', 'species']
        const removeUselessNode = function(node, negative_depth) {
            node.depth -= negative_depth;
            if (!node.children) {
                return;
            }
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
        const addToParents = function(parent, val) {
            parent.value += val
            if (parent.parent) {
                addToParents(parent.parent, val)
            }
        }

        const removeNonRanks = function(node) {
            if (!node.children) {
                return;
            }

            if (node.parent &&
                !ranks.includes(node.data.rank)) {

                const node_i = node.parent.children.indexOf(node)

                if (node.children) {
                    // move node's children into parent!
                    node.parent.children.splice(node_i, 1, ...node.children)

                    node.children.forEach(d => {
                        d.parent = node.parent;
                    })
                } else {
                    if (node.parent.children.length == 1) {
                        delete node.parent.children;
                    } else {
                        node.parent.children = node.parent.children.slice(node_i);
                    }
                }
                if (node.value > 0) {
                    //node.parent.value += node.value
                    //addToParents(node.parent, node.value);
                }
            }
        }
        const fix_depths = function(d, depth) {
            d.depth = depth
            if (d.children) {
                d.children.forEach(e => { fix_depths(e, depth+1) } )
            }
        }

        root.each(removeNonRanks)
        //removeNonRanks(root, 0);
        fix_depths(root, 0)
        // TODO: Fix height
    }

    if (opts.treeColors) {
        const tcol = TreeColors(opts.treeColors);
        //tcol.luminanceDelta = -20;
        tcol(root)
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
    stat: "identity", // possible choices: identity, sum, and count
    buttons: false, // show buttons to switch layout
    transitionDuration: 100,
    numberFormat: ",d",
    breadcrumbs: true,
    debug_mode: false,
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
    sankeyLinkDist: 0,
    sankeyNoRoot: false,
    showRank: true,
    linkColorChild: false, // it true, color links based on child, not the parent
    sankeyMinHeight: null, // if numeric, labels are only displayed when the node is above the value
    nodeCornerRadius: 2,
    sankeyLinkOpacity: .5,
    sankeyNodeSize: 10,
    scaleWidth: false, // scale width in horizontal Sankey based on text width - experimental and buggy
    sankeyNodeDist: 2,
    textPadding: 1,
    minText: 4,
    // Stratify options
    parentField: null, // field for parent when using stratify
    pathSep: "/", // Use separator on nameField to get name and parent when using stratify
    clipPath: true // Set name to the last part of path. When false, the name is the full path
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
                console.error("ERROR: Ignoring unknown option " + opt)
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
        this.dispatch = d3.dispatch("mouseover", "mouseout", "clicked");

        this.svg = svg;

    }

    set vis(value) {
        this.opts.vis = value;
    }

    set_opt(sel, value) {
        this.opts[sel] = value;
        if (sel == "treeColors" && value) {
            const tcol = TreeColors("add");
            tcol(this.root)
        }
        this.draw();
    }

    filter(val, txt_regex) {
        const self = this;
        let changed_nodes = 0;
        if (txt_regex.match(/\|$/)) {
            txt_regex = txt_regex.slice(0, -1);
        }
        const re = new RegExp("^" + txt_regex + "$");

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
                for (let i = 0; i < node.children_sav.length; i++) {
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
                if (children_new.length) {
                    node.children = children_new;
                } else {
                    delete node.children;
                }
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
        this.extent = this.horizontal? this.height : this.width;
        this.extent_y = this.horizontal? this.width : this.height;
        this.extent_x = this.horizontal? this.height : this.width;
        rectBB.remove();
        this.maxRadius = Math.min(this.width, this.height) / 3;
        this.svg.selectAll("*").remove();
        this.svg.attr('viewBox', null);

        // Set CSS styles
        this.svg.append("style").text(`
.slice { cursor: pointer; }
.slice .main-arc { stroke: #fff; stroke-width: 1px; }
.slice .hidden-arc { fill: none; }
.slice text { pointer-events: none; /*dominant-baseline: middle;*/ text-anchor: middle; }
.slice .text-countour { fill: none; stroke: #fff; stroke-width: 5; stroke-linejoin: round; }
text { padding: 2px; font: 12px sans-serif; }
g.partition g rect { stroke: #fff; opacity: .5; }
g.partition g.selected rect { stroke: #fff; opacity: .8; }
g.sankey g path { opacity: ${this.opts.sankeyLinkOpacity}; }
g.sankey g.selected path { opacity: ${this.opts.sankeyLinkOpacity * 1.5}; }
g.rects g rect { stroke: #fff; }
g.sankey g rect {
  rx: ${this.opts.nodeCornerRadius};
  ry: ${this.opts.nodeCornerRadius};
}

g.links path { stroke: #fff; opacity: 0.7; }

g.labels text {
  cursor: pointer;
  text-anchor: start;
  vertical-align: bottom;
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

text.selected {
  text-shadow: 0 0 2px #fff;
}

text.hidden {
  opacity: .1;
}

`);

        switch (vis) {
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

    goUp(n) {
        // does not work currently - requires heavy refactoring
        /*
        var new_node = self.selected;
        var i = 0
        while (new_node && new_node.parent && i < n) {
            new_node = new_node.parent
            i++
        }
        clicked(new_node, false);
        */
    }

    vertical_sankey() {
        this.icicle(false, false, true)
    }

    icicle(horizontal = false, is_treemap = false, is_sankey = false) {
        const self = this;

        const x0 = horizontal ? "y0" : "x0",
            x1 = horizontal ? "y1" : "x1",
            y0 = horizontal ? "x0" : "y0",
            y1 = horizontal ? "x1" : "y1";

        const xx = horizontal ? "y" : "x";
        const yy = horizontal ? "x" : "y";

        let nodes;
        let max_depth = 1;

        const ranks = ['superkingdom', 'phylum', 'family', 'genus', 'species']

        const alignRanks = function(root) {
            var max_rank_depth;
            var rank_nodes = [];
            const getRankNodes = function(d, rank) {
                if (d.data.rank === rank) {
                    if (!max_rank_depth || d.y0 > max_rank_depth.y0) {
                        max_rank_depth = d;
                    }
                    rank_nodes.push(d);
                } else if (d.children) {
                    d.children.forEach(e => {
                        getRankNodes(e, rank);
                    });
                }
            }

            // Convenience function to apply to all children
            //   root.each() doesn't work here, yet
            const updateChildren = function(d, acc, delta) {
                acc.forEach(f => { d[f] += delta; });
                if (d.children) {
                    d.children.forEach(e => {
                        updateChildren(e, acc, delta);
                    })
                }
            }

            ranks.forEach(rank => {
                max_rank_depth = root;
                rank_nodes = [];
                getRankNodes(root, rank);
                if (rank_nodes.length) {
                    rank_nodes.forEach(e => {
                        if (e.y0 < max_rank_depth.y0) {
                            const y_diff = max_rank_depth.y0 - e.y0;
                            updateChildren(e, ["y0", "y1"], y_diff);
                        }
                    });
                }
            });
        
            // sets extent of the current node (y0 -> y1) to the closest child node
            const set_y1 = function(d) {
                if (d.children) {
                    var min_y0;
                    d.children.forEach(e => {
                        if (!min_y0 || e.y0 < min_y0) {
                            min_y0 = e.y0
                        }
                        set_y1(e);
                    });
                    d.y1 = min_y0;
                }
            }
            //set_y1(root);
        }

        const shiftNodes = function(d, delta, y0, y1) {
            d[y0] += delta;
            d[y1] += delta;
            if (d.children) {
                d.children.forEach((e, i) => {
                    shiftNodes(e, delta, y0, y1)
                })
            }
        }

        // pads Sankey nodes - expects global 'max_y1', 'max_fact' and 'min_val' variables
        const padNodes = function(d, delta, y0, y1) {
            const y1_b4 = d[y1];
            // Save the minimum y0 and maximum y1 for zooming and clipping purposes
            d[y0] += delta;
            d[y1] += delta;
            d.lower_bound = d[y0]
            d.upper_bound = d[y1]
            if (d.children) {
                const delta_start = delta;
                d.children.forEach((e, i) => {
                    delta = padNodes(e, delta, y0, y1)
                    if (i < d.children.length - 1) {
                        delta += self.opts.sankeyNodeDist;
                    }
                })

                // Set parent at the middle
                var y1_diff = d[y1] - max_y1
                if (y1_diff < 0) {
                    delta = max_y1 - d[y1] + delta_start;
                    const shift_delta = delta / 2 - delta_start / 2;
                    d[y0] += shift_delta
                    d[y1] += shift_delta;
                    d.upper_bound = max_y1;
                } else {
                    var shiftDelta = self.opts.sankeyNodeDist
                    if (y1_diff > self.opts.sankeyNodeDist) {
                        console.log(["meh", y1_diff])
                        // TODO meeeeeeeh
                        //
                        for (let i = 1; i < d.children.length; ++i) {
                          d.children.forEach((e, i) => {
                            if (y1_diff > shiftDelta) {
                              shiftNodes(d.children, shiftDelta, y0, y1)
                              shiftDelta += self.opts.sankeyNodeDist;
                            }
                          })
                        }
                    }
                    delta = delta_start // + self.opts.sankeyNodeDist/2;
                }
            }
            if (d[y1] > max_y1) {
                max_y1 = d[y1]
                max_fact = max_y1 / y1_b4;
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
            max_depth = 1;
            this.root.each(d => {
                if (d.depth > max_depth) {
                    max_depth = d.depth;
                }
            })
            if (is_sankey) {
                scale_factor = max_depth / (max_depth + 1)
            }
            if (horizontal) {
                partition.size([this.height, this.width * scale_factor])
            } else {
                partition.size([this.width, this.height * scale_factor])
            }

            partition(this.root);

            self.current_node = self.root;
            self.selected_node = self.root;

            if (is_sankey) {

                if (self.opts.showRank) {
                    alignRanks(this.root);
                }

                // variables that are modified by padNodes
                var max_fact = 1,
                    max_y1 = 0,
                    min_val = this.root.value / 100;

                padNodes(this.root, 0, "x0", "x1")
            }

            nodes = this.root.descendants();

            nodes.forEach((d, i) => {
                d.w = d[x1] - d[x0];
                d.h = d[y1] - d[y0];
                d._unique_id = i;
                d.children_x0s = 0;
            })
            if (is_sankey) {
                nodes.forEach(d => {
                    if (d.parent) {
                        d.sibling_x0s = (d.parent.children_x0s || 0);
                        d.parent.children_x0s = (d.parent.children_x0s || 0) + d.x1 - d.x0

                    }
                    if (d.children) {
                        d.children_min_y0 = d3.min(d.children, e => e.y0)
                    }
                })

            }
        }

        const point = function(x_pos, y_pos) { 
            if (self.horizontal) {
                return([y_pos, x_pos]);
            } else {
                return([x_pos, y_pos]);
            }
        }

        // partition group contains all nodes, links and clip paths
        //   TOCHECK: The clip paths are for the text labels. It could be that
        //   the performance is better if the clip paths are grouped with the text
        const partition_group =
            self.svg.append("g")
            .attr("class",
                (is_sankey ? "sankey" : "partition") +
                (horizontal ? " horizontal" : " vertical"));

        // Have labels separate so that they are rendered last
        const text_group = self.svg.append("g")
            .attr("class", "labels" +
                (is_sankey ? " sankey" : " partition") +
                (horizontal ? " horizontal" : " vertical"));

        self.max_x1 = 0;
        self.max_y1 = 0;

        self.root.each(d=> { 
            if (d[x1] > self.max_x1) self.max_x1 = d[x1];  
            if (d[y1] > self.max_y1) self.max_y1 = d[y1];
        })

        /* // alternative scaling - does scale text, too, though
        const x_scale_factor = self.extent_x / self.max_x1;
        const y_scale_factor = self.extent_y / self.max_y1;
        console.log([x_scale_factor, y_scale_factor])
        if (y_scale_factor != 0 | x_scale_factor != 0) {
            partition_group.attr(
                "transform", 
                "scale(" + point(x_scale_factor, y_scale_factor).join(",") + ")")
            text_group.attr(
                "transform", 
                "scale(" + point(x_scale_factor, y_scale_factor).join(",") + ")")
        }
        const x_scale = d3.scaleLinear()
            .range([0, self.extent_x]).domain([0, self.extent_x]);
        const y_scale = d3.scaleLinear()
            .range([0, self.extent_y]).domain([0, self.extent_y]);
        */

        var min_y = self.opts.sankeyNoRoot? self.root.children_min_y0 : 0

        const x_scale = d3.scaleLinear()
            .range([0, self.extent_x]).domain([self.opts.horizontal? 0 : min_y, self.max_x1]);
        const y_scale = d3.scaleLinear()
            .range([0, self.extent_y]).domain([self.opts.horizontal? min_y : 0, self.max_y1]);



        // Enter partition and texts
        var partition_group1 =
            partition_group.selectAll("g")
            .data(nodes).enter().append("g")

        var text_group1 =
            text_group.selectAll("text")
            .data(nodes).enter().append("text")

        if (self.opts.sankeyNoRoot) {
            text_group1 = text_group1.filter(d => d.parent)
            partition_group1 = partition_group1.filter(d => d.parent)
        }

        // HELPER FUNCTIONS start ///
        const identity = function(d) {
            return d;
        }

        const set_texts = function(selection, x, y) {
            if (is_sankey) {
                selection
                    .attr("x", d => !horizontal ? x((d[x0] + d[x1]) / 2) : x(d[x0]) + self.opts.sankeyNodeSize + self.opts.textPadding)
                    .attr("y", d => horizontal ? y((d[y0] + d[y1]) / 2) : y(d[y0]) + self.opts.sankeyNodeSize + self.opts.textPadding)
            } else {
                selection
                    .attr("x", d => x(d[x0]) + self.opts.textPadding)
                    .attr("y", d => y(d[y0]) + self.opts.textPadding)
            }
        };

        const set_tspans = function(selection, x, y) {
            if (is_sankey) {
                selection.attr("x", d => !horizontal ? x((d[x0] + d[x1]) / 2) : x(d[x0]) + self.opts.sankeyNodeSize + self.opts.textPadding)
            } else {
                selection.attr("x", d => x(d[x0]) + self.opts.textPadding)
            }
        };

        const rects = function(selection, x, y) {
            if (is_sankey) {
                sankey_rects(selection, x_scale, y_scale)
            } else {
                partition_rects(selection, x_scale, y_scale)
            }
        };

        const partition_rects = function(selection, x, y) {
            selection.attr("x", d => x(d[x0]))
                .attr("y", d => y(d[y0]))
                .attr("width", d => x(d[x1]) - x(d[x0]))
                .attr("height", d => y(d[y1]) - y(d[y0]))
        };

        const sankey_clip_rects = function(selection, x, y) {
            if (horizontal) {
                selection
                    .attr("x", d => x(d[x0]))
                    .attr("y", d => y(d.lower_bound - self.opts.sankeyNodeDist / 4))
                    .attr("width", d => (d.children && d.children.length) ? x(d[x1]) - x(d[x0]) : self.width)
                    .attr("height", d => d.children ? y(d.upper_bound + self.opts.sankeyNodeDist / 2) - y(d.lower_bound) : self.height)
            } else {
                selection
                    .attr("x", d => x(d.lower_bound - self.opts.sankeyNodeDist / 4))
                    .attr("y", d => y(d[y0]))
                    .attr("height", d => (d.children && d.children.length) ? y(d[y1]) - y(d[y0]) : self.width)
                    .attr("width", d => x(d.upper_bound + self.opts.sankeyNodeDist / 2) - x(d.lower_bound))
            }
        };


        const sankey_clip_polygons = function(selection, x_scale, y_scale) {
            const point = function(x_pos, y_pos) {
                if (horizontal) {
                    return x_scale(y_pos) + " " + y_scale(x_pos);
                } else {
                    return x_scale(x_pos) + " " + y_scale(y_pos);

                }
            }

            selection.attr("points", d=> {
                var start_x0 = d.lower_bound - self.opts.sankeyNodeDist/2;
                var end_x1 = d.upper_bound + self.opts.sankeyNodeDist/2;
                var points = [point(start_x0, d.y0)];
                if (d.children) {
                    var child_y0 = d.children[0].y0
                    var i = 1;
                    while (i < d.children.length) {
                        if (d.children[i].y0 === child_y0) {
                            // continue - do not put out extra node if that child is at the same distance
                        } else {
                            points.push(point(start_x0, child_y0),
                                        point(d.children[i-1].x1, child_y0))
                            start_x0 = d.children[i].x0
                            child_y0 = d.children[i].y0
                        }
                        ++i;
                    }
                    const last_child_x1 = d.children[i-1].x1
                    points.push(point(start_x0, child_y0),
                                point(last_child_x1, child_y0));
                    if (last_child_x1 < d.x1) {
                        // No children after there
                        points.push(point(last_child_x1, self.extent),
                                    point(d.x1, self.extent))
                    } else if (last_child_x1 > d.x1) {
                        points.push(point(last_child_x1, d.y0))
                    }
                } else {
                    points.push(point(d.x0, d.y1),
                                point(d.x1, d.y1))
                }
                points.push(point(end_x1, d.y0));
                return(points.join(","));
            })
            
        };

        const sankey_rects = function(selection, x, y) {
            selection.attr("x", d => x(d[x0]))
                .attr("y", d => y(d[y0]))
                .attr("visibility", null)
                .attr("width", d => horizontal ? self.opts.sankeyNodeSize : x(d[x1]) - x(d[x0]))
                .attr("height", d => !horizontal ? self.opts.sankeyNodeSize : y(d[y1]) - y(d[y0]))
        }

        const parent_rect = function(selection, x, y) {
            // Center the parent rectangle on the left side
            selection.attr("x", d => !horizontal ? Math.max(0, (self.width - x(d[x1]) + x(d[x0])) / 2) : 0)
                .attr("y", d => horizontal ? Math.max(0, (self.height - y(d[y1]) + y(d[y0])) / 2) : 0)
        }

        const mouseover = function(d) {
            self.current_node = d;
            self.dispatch.call("mouseover", this, get_path(d));
        }

        const mouseout = function(d) {
            self.dispatch.call("mouseover", this, get_path(self.selected));
            //d3.selectAll('text.hidden').classed('hidden', false)
        }

        const get_path = function(d) {

            const update_node = function(d) {
                partition_group1
                    .filter(d1 => d1 == d)
                    //.transition()
                    //.duration(self.opts.transitionDuration / 10)
                    .attr("class", "selected");
/*
                text_group1
                    .filter(d1 => d1 == d)
                    .attr("visibility", "null")
                    //.transition()
                    //.duration(self.opts.transitionDuration / 10)
                    .attr("class", "selected");*/
            }
            if (!d) {
                return;
            }
            var col = self._color(d).toString();
            var path = [{
                text: d.data[self.opts.nameField] + " " + self.formatNumber(d.value),
                fill: col
            }];

            self.last_selected = d

            d3.selectAll('g.selected').classed('selected', false)
            d3.selectAll('text.selected').classed('selected', false)
            //d3.selectAll('text.selected').classed('hidden', false)
/*
            text_group1
                    //.attr("class", "hidden")
                    .attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
                   .filter(d1 => d1 == d)
                   .attr("visibility", null)
                   .attr("clip-path", null)
*/

            update_node(d);
            while (d.parent) {
                d = d.parent;
                update_node(d);
                col = self._color(d).toString();
                path.push({
                    text: d.data[self.opts.nameField],
                    value: d.value,
                    rank: d.rank,
                    fill: col
                });
            }
            return (path.reverse());
        }

        const clicked = function(d, call_dispatch = true) {
            if (call_dispatch) {
                self.dispatch.call("clicked", this, get_path(d));
            }
            if (self.selected == d) {
                return;
            }
            self.selected = d;
            self.current_node = d;
            if (horizontal) {
                let min_x = d.depth ? self.width / 10 : 0;
                if (d.parent && d[x0] - d.parent[x0] < min_x) {
                    min_x = d[x0] - d.parent[x0];
                }

                x_scale.domain([d[x0], self.max_x1]).range([min_x, self.extent_x]);
                if (is_sankey) {
                    console.log(d)
                    y_scale.domain([d.lower_bound, d.upper_bound])
                } else {
                    y_scale.domain([d[y0], d[y1]]);
                }
            } else {
                let min_y = d.depth ? self.height / 10 : 0;
                if (d.parent && d[y0] - d.parent[y0] < min_y) {
                    min_y = d[y0] - d.parent[y0];
                }

                if (is_sankey && !horizontal) {
                    x_scale.domain([d.lower_bound, d.upper_bound])
                } else {
                    x_scale.domain([d[x0], d[x1]]);
                }
                y_scale.domain([d[y0], self.max_y1]).range([min_y, self.extent_y]);
            }

            if (is_sankey) {
                sankey_cliprect_objects.transition()
                    .duration(self.opts.transitionDuration)
                    .call(sankey_clip_polygons, x_scale, y_scale)

                sankey_path_objects.transition()
                    .duration(self.opts.transitionDuration)
                    .call(sankey_links, x_scale, y_scale)
                    .filter(d1 => d1.depth <= d.depth)
                    .attr("visibility", "hidden")
            }

            rect_objects.transition()
                .duration(self.opts.transitionDuration)
                .call(rects, x_scale, y_scale)
                .filter(d1 => d1 === d.parent).call(parent_rect, x_scale, y_scale)

            text_objects.transition()
                .duration(self.opts.transitionDuration)
                .attr("visibility", d => {
                    return (y_scale(d[y1]) - y_scale(d[y0]) > self.opts.minText ? null : "hidden");
                })
                .call(set_texts, x_scale, y_scale)

            if (self.opts.showNumbers && self.opts.numbersOnNextLine)
                tspan_objects.transition()
                .duration(self.opts.transitionDuration)
                .call(set_tspans, x_scale, y_scale)
        }

        const keydown = function() {
            const keyCode = d3.event.keyCode;
            if (!self.current_node) {
                self.current_node = self.root;
            }
            const toNext = function() {
                    if (self.current_node.parent) {
                        var cnpc = self.current_node.parent.children;
                        var i = cnpc.indexOf(self.current_node);
                        if (i < cnpc.length - 1) {
                            mouseover(cnpc[i + 1]);
                        } else {
                            mouseover(cnpc[0]);
                        }
                    } else if (self.current_node.children) {
                        mouseover(self.current_node.children[0])
                    };
            } 

            const toPrevious = function() {
                    if (self.current_node.parent) {
                        var cnpc = self.current_node.parent.children;
                        var i = cnpc.indexOf(self.current_node);
                        if (i >= 1) {
                            mouseover(cnpc[i - 1]);
                        } else {
                            mouseover(cnpc[cnpc.length - 1]);
                        }
                    } else if (self.current_node.children && self.current_node.children.length > 0) {
                        mouseover(self.current_node.children[self.current_node.children.length - 1])
                    };
            }

            const toChild = function() {
                    if (self.current_node.children) {
                        mouseover(self.current_node.children[0]);
                    };
            }

            const toParent = function() {
                    if (self.current_node.parent && self.current_node != self.selected_node) {
                        mouseover(self.current_node.parent);
                    };
            }


            switch (keyCode) {
                case 8: // backspace
                    if (self.selected && self.selected.parent) {
                        clicked(self.selected.parent);
                    };
                    break;
                case 13: // enter
                    if (self.current_node) {
                        clicked(self.current_node);
                    };
                    break;
                case 27: // escape
                    clicked(self.root);
                    break;
                case 37: // left
                    horizontal? toParent() : toPrevious();
                    break; // left
                case 38: // up
                    horizontal? toPrevious() : toParent();
                    break; // up
                case 39: //right
                    horizontal? toChild() : toNext();
                    break; // right
                case 40: //down
                    horizontal? toNext() : toChild();
                    break; // down
                case 68: // letter d - debug modus
                    self.opts.debug_mode = !self.opts.debug_mode;
                    break;
                case 187: // resize height - plus
                    self.svg.attr("height", parseInt(self.svg.attr("height")) + 25);
                    self.draw();
                    break;
                case 189: // resize height - minus
                    self.svg.attr("height", Math.max(100, (parseInt(self.svg.attr("height")) - 25)));
                    self.draw();
                    break;
            }
        }

        const sankey_links = function(selection, x, y) {
            const lh = horizontal? d3.linkHorizontal() : d3.linkVertical();

            const x_scale = horizontal? y : x;
            const y_scale = horizontal? x : y;

            const point = function(x_pos, y_pos) {
                if (horizontal) {
                    return [y_pos, x_pos];
                } else {
                    return [x_pos, y_pos];
                }
            }

            selection
                .attr("visibility", null)
                .filter(d => d.parent && (!self.opts.sankeyNoRoot || d.parent.parent))
                .attr('d', d => {
                    var min_sibling_y0 = d.parent.children_min_y0;

                    const width = x_scale(d.x1) - x_scale(d.x0)

                    // Is one of the siblings of this nodes closer to the parent node
                    //  than this one? If yes, be sure to add an extra distance columns
                    const diff_y0 = y_scale(d.y0) - y_scale(min_sibling_y0);

                    var link = lh({
                            source: point(
                                x_scale(d.parent.x0 + d.sibling_x0s),
                                y_scale(d.parent.y0) + self.opts.sankeyNodeSize + self.opts.sankeyLinkDist),
                            target: point(
                                x_scale(d.x0),
                                y_scale(min_sibling_y0) - self.opts.sankeyLinkDist)
                    })
                    if (diff_y0 > 0) { // move diff_y0 down
                        link += " l " + point(0, diff_y0).join(" ")
                    }
                    link += " l " + point(width, 0)  // move width over

                    if (diff_y0 > 0) { // move diff_y0 up
                        link += " l " + point(0, -diff_y0)
                    }
                    link += " L " +
                        lh({
                            source: point(
                                x_scale(d.x1),
                                y_scale(min_sibling_y0) - self.opts.sankeyLinkDist),
                            target: point(
                                x_scale(d.parent.x0 + d.sibling_x0s + d.x1 - d.x0),
                                y_scale(d.parent.y0) + self.opts.sankeyNodeSize + self.opts.sankeyLinkDist)
                        }).slice(1);
                    return link;
                })
        }

        // HELPER FUNCTIONS end //

        // add keypress events
        d3.select("body").on("keydown", keydown);

        // the objects containing the elements
        let sankey_path_objects, sankey_cliprect_objects,
            rect_objects, text_objects, tspan_objects;

        text_objects = text_group1
            .text(d => d.data[this.opts.nameField]);

        if (self.opts.scaleWidth && is_sankey && horizontal) {
            var wh = "width";
            var max_width_at_depth = new Array(max_depth + 1);
            text_objects.each(function(d) {
                if (d.value > min_val) {
                    let bb = this.getBBox();
                    if (!max_width_at_depth[d.depth] || bb[wh] > max_width_at_depth[d.depth]) {
                        max_width_at_depth[d.depth] = Math.min(100, bb[wh]);
                    }
                }
            });

            var sel_width_at_depth = new Array(max_depth + 1);
            sel_width_at_depth[0] = 0;
            for (let i = 1; i < max_depth + 1; i++) {
                sel_width_at_depth[i] = sel_width_at_depth[i - 1] +
                    max_width_at_depth[i - 1] + self.opts.sankeyNodeSize + 5;
            }

            if (self.opts.debug_mode) {
                console.log("Getting bounding boxes of text");
            }

            this.root.each(function(d) {
                d[x0] = sel_width_at_depth[d.depth];
                d[x1] = sel_width_at_depth[d.depth] + max_width_at_depth[d.depth] + self.opts.sankeyNodeSize;
            });
        }

        if (is_sankey) {
            sankey_cliprect_objects = partition_group1.append("clipPath")
                .attr("id", (d, i) => "clip-" + i + self.ID)
                .append("polygon")
                .call(sankey_clip_polygons, x_scale, y_scale);

            // add Sankey rects
            rect_objects = partition_group1.append("rect")
                .call(sankey_rects, x_scale, y_scale);

            // add Sankey links
            sankey_path_objects = partition_group1.append('path')
                .on("click", d => clicked(d))
                .on("mouseover", d => {
                    mouseover(d)
                })
                .on("mouseout", mouseout)
                .style("cursor", "pointer")
                .style('fill', d => self._color(self.opts.linkColorChild ? d : d.parent))
                .call(sankey_links, x_scale, y_scale);
        } else {
            rect_objects = partition_group1.append("rect")
                .attr("id", (_, i) => "rect-" + i + self.ID)
                .call(rects, x_scale, y_scale)

            partition_group1.append("clipPath")
                .attr("id", (d, i) => "clip-" + i + self.ID)
                .append("use")
                .attr("xlink:href", (_, i) => "#rect-" + i + self.ID);
        }

        var min_val = this.root.value / 100;

        /*    if (is_sankey) {
                text
                    .filter(d => d.upper_bound - d.lower_bound < 10)
                    .attr("visibility", "hidden")
            }*/

        text_group1.attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")

        text_objects
            .attr("visibility", d => {
                return (d[y1] - d[y0] >= self.opts.minText ? "visible" : "hidden");
            })
            .call(set_texts, x_scale, y_scale)
            .on("click", d => clicked(d))
            .on("mouseover", mouseover)
            .on("mouseout", mouseout)
        text_objects.append('title')
            .text(d => d.data[this.opts.nameField] + '\n' + this.formatNumber(d.value));

        if (is_sankey && horizontal) {
            text_objects.attr("dy", ".25em");
        } else {
            text_objects.attr("dy", "1em");
        }

        if (this.opts.showNumbers) {
            tspan_objects = text_objects.append("tspan")
                .text(d => " " + this.formatCircleNumber(d.value))
            if (this.opts.numbersOnNextLine) {
                tspan_objects.call(set_tspans, x_scale, y_scale)
                    .attr("dy", "1em")

            }
        }
        //.filter(d => d[y1] - d[y0] >= 10)

        rect_objects.attr('fill', d => this._color(is_treemap && !this.opts.treeColors ? d.parent : d))
            .style("cursor", "pointer")
            .on("click", d => clicked(d))
            .on("mouseover", mouseover)
            .on("mouseout", mouseout)
            .append('title')
            .text(d => d.data[this.opts.nameField] + '\n' + this.formatNumber(d.value));

        if (self.opts.scaleWidth && is_sankey && horizontal) {
            clicked(self.root, d);
        }
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
            .attr("class", d => "node " + (d.children ? "node--internal" : "node--leaf"))
            .attr("transform", d => "translate(" + d.y + "," + d.x + ")")

        node.append("circle").attr("r", 2.5);
        node.append("text")
            .attr("dy", 3)
            .attr("x", d => d.children ? -8 : 8)
            .style("text-anchor", d => d.children ? "end" : "start")
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
            .range([this.maxRadius * .1, this.maxRadius]);

        const arc = d3.arc()
            .startAngle(d => x(d.x0))
            .endAngle(d => x(d.x1))
            .innerRadius(d => Math.max(0, y(d.y0)))
            .outerRadius(d => Math.max(0, y(d.y1)));

        const middleArcLine = d => {
            const halfPi = Math.PI / 2;
            const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
            const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

            const middleAngle = (angles[1] + angles[0]) / 2;
            const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
            if (invertDirection) {
                angles.reverse();
            }

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

        const text_objects = newSlice.append('text');
        if (this.opts.sunburstContour) {
            // Add white contour
            text_objects.append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => "#hiddenArc-" + i + self.ID)
                .text(d => d.data[this.opts.nameField])
                .attr('class', 'text-contour');
        }

        if (this.opts.sunburstLabelsRadiate) {
            // TODO: fix that -  doesn't work well, yet
            text_objects
                //.attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
                // clip-path doesn't work
                .attr("transform", (d) => {
                    const angle = (x(d.x0) + x(d.x1)) * 90 / Math.PI - 90
                    const res = "translate(" + arc.centroid(d) + ")rotate(" + ((angle > 90 || angle < -90) ? angle - 180 : angle) + ")"
                    return res;
                })
                .text(d => d.data[this.opts.nameField]);
        } else {
            const text2 = text_objects
                .attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")
                .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => "#hiddenArc-" + i + self.ID)
                .text(d => d.data[this.opts.nameField]);

            if (this.opts.showNumbers)
                text2.append("tspan")
                .attr('x', '0')
                .attr("dy", "1em")
                .text(d => self.formatCircleNumber(d.value));
        }

        const sankeyClicked = function(d = {
            x0: 0,
            x1: 1,
            y0: 0,
            y1: 1
        }) {
            // Reset to top-level if no data point specified
            if (!d.children)
                return;
            const transition = self.svg.transition()
                .duration(self.opts.transitionDuration)
                .tween('scale', () => {
                    const xd = d3.interpolate(x_scale.domain(), [d.x0, d.x1]),
                        yd = d3.interpolate(y.domain(), [d.y0, 1]);
                    return t => {
                        x_scale.domain(xd(t));
                        y_scale.domain(yd(t));
                    };
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
                        if (d.parent) {
                            moveStackToFront(d.parent);
                        }
                    })
            }
        }
        /*
        function computeTextRotation(d) {
          return ((d.x0 + d.x1)/2 - Math.PI / 2) / Math.PI * 180;
        }*/
    }

    _color(d) {
        if (!d) {
            return ("#2777B4");
        }
        if (this.opts.colorField) {
            return d.data[this.opts.colorField];
        } else if (this.opts.treeColors) {
            return d3.hcl(d.color.h, d.color.c, d.color.l);
        } else {
            return (colorScale(d.data[this.opts.nameField]) || "#2777B4");
        }
        /*else if (d.children) {
          return d3.rgb(colorScale(d.data.name)).brighter(d.depth/5);
        } else {
          return d3.rgb(colorScale(d.parent.data.name)).brighter(d.depth/5);
        } */
    }
}
