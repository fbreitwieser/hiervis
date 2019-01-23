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

    if (opts.simplifyPath) {
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
        removeUselessNode(root, 0);
        // TODO: Fix height
    }

    if (opts.treeColors) {
        const tcol = TreeColors(opts.treeColors);
        //tcol.luminanceDelta = -20;
        tcol(root)
    }

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
            root.each(node => {
                node.value = node.data[opts.valueField]
            });
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
    stat: "identity", // possible choices: identity, sum, and count
    buttons: false, // show buttons to switch layout
    transitionDuration: 350,
    numberFormat: ",d",
    debug_mode: false,
    // General options
    showNumbers: true,
    treeColors: true,
    krakenFile: false,
    simplifyPath: false, // Remove nodes without a value, and only one child
    // Treemap options
    treemapHier: true,
    // Sunburst options
    sunburstLabelsRadiate: false,
    circleNumberFormat: ".2s",
    // Sankey options
    linkColorChild: true, // it true, color links based on child, not the parent
    sankeyMinHeight: null, // if numeric, labels are only displayed when the node is above the value
    nodeCornerRadius: 2,
    sankeyLinkOpacity: .5,
    sankeyNodeSize: 10,
    scaleWidth: false, // scale width in horizontal Sankey based on text width - experimental and buggy
    sankeyNodeDist: .5,
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

        // pads Sankey nodes - expects global 'max_y1', 'max_fact' and 'min_val' variables
        const padNodes = function(d, delta, y0, y1) {
            const y1_b4 = d[y1];
            // Save the minimum y0 and maximum y1 for zooming and clipping purposes
            d[y0] += delta;
            d[y1] += delta;
            d.children_min_y0 = d[y0]
            d.children_max_y1 = d[y1]
            if (d.children) {
                const delta_start = delta;
                d.children.forEach((e, i) => {
                    delta = padNodes(e, delta, y0, y1)
                    if (i < d.children.length - 1) {
                        delta += self.opts.sankeyNodeDist;
                        //delta += e.children && e.children.length? self.opts.sankeyNodeDist/2 : self.opts.sankeyNodeDist;
                        //if (e.value > min_val) {
                        //  delta += self.opts.sankeyNodeDist;
                        //} else {
                        //  delta += 0.1;
                        //}
                    }
                })

                // Set parent at the middle
                if (max_y1 > d[y1]) {
                    delta = max_y1 - d[y1] + delta_start;
                    const shift_delta = delta / 2 - delta_start / 2;
                    d[y0] += shift_delta
                    d[y1] += shift_delta;
                    d.children_max_y1 = max_y1;
                } else {
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
                // variables that are modified by padNodes
                var max_fact = 1,
                    max_y1 = 0,
                    min_val = this.root.value / 100;

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

        // partition group contains all nodes, links and clip paths
        //   TOCHECK: The clip paths are for the text labels. It could be that
        //   the performance is better if the clip paths are grouped with the text
        const partition_group =
            this.svg.append("g")
            .attr("class",
                (is_sankey ? "sankey" : "partition") +
                (horizontal ? " horizontal" : " vertical"));

        // Have labels separate so that they are rendered last
        const text_group = this.svg.append("g")
            .attr("class", "labels" +
                (is_sankey ? " sankey" : " partition") +
                (horizontal ? " horizontal" : " vertical"));

        // Enter partition and texts
        const partition_group1 =
            partition_group.selectAll("g")
            .data(nodes).enter().append("g")

        const text_group1 =
            text_group.selectAll("text")
            .data(nodes).enter().append("text")

        // HELPER FUNCTIONS start ///
        const identity = function(d) {
            return d;
        }

        const set_texts = function(selection, x = identity, y = identity) {
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

        const set_tspans = function(selection, x = identity, y = identity) {
            if (is_sankey) {
                selection.attr("x", d => !horizontal ? x((d[x0] + d[x1]) / 2) : x(d[x0]) + self.opts.sankeyNodeSize + self.opts.textPadding)
            } else {
                selection.attr("x", d => x(d[x0]) + self.opts.textPadding)
            }
        };

        const rects = function(selection, x = identity, y = identity) {
            if (is_sankey) {
                sankey_rects(selection, x, y)
            } else {
                partition_rects(selection, x, y)
            }
        };

        const partition_rects = function(selection, x = identity, y = identity) {
            selection.attr("x", d => x(d[x0]))
                .attr("y", d => y(d[y0]))
                .attr("width", d => x(d[x1]) - x(d[x0]))
                .attr("height", d => y(d[y1]) - y(d[y0]))
        };

        const sankey_clip_rects = function(selection, x = identity, y = identity) {
            if (horizontal) {
                selection
                    .attr("x", d => x(d[x0]))
                    .attr("y", d => y(d.children_min_y0 - self.opts.sankeyNodeDist / 4))
                    .attr("width", d => (d.children && d.children.length) ? x(d[x1]) - x(d[x0]) : self.opts.width)
                    .attr("height", d => d.children ? y(d.children_max_y1 + self.opts.sankeyNodeDist / 2) - y(d.children_min_y0) : self.height)
            } else {
                selection
                    .attr("x", d => x(d.children_min_y0 - self.opts.sankeyNodeDist / 4))
                    .attr("y", d => y(d[y0]))
                    .attr("height", d => (d.children && d.children.length) ? y(d[y1]) - y(d[y0]) : self.opts.width)
                    .attr("width", d => x(d.children_max_y1 + self.opts.sankeyNodeDist / 2) - x(d.children_min_y0))
            }
        };

        const sankey_rects = function(selection, x = identity, y = identity) {
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
        }

        const get_path = function(d) {

            const update_node = function(d) {
                partition_group1
                    .filter(d1 => d1 == d)
                    .transition()
                    .duration(self.opts.transitionDuration / 10)
                    .attr("class", "selected");
            }
            if (!d) {
                return;
            }
            d3.selectAll('g.selected').classed('selected', false)

            var col = self._color(d).toString();
            var path = [{
                text: d.data[self.opts.nameField] + " " + self.formatNumber(d.value),
                fill: col
            }];
            update_node(d);

            while (d.parent) {
                d = d.parent;
                update_node(d);
                col = self._color(d).toString();
                path.push({
                    text: d.data[self.opts.nameField] + " " + self.formatNumber(d.value),
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

                x.domain([d[x0], self.width]).range([min_x, self.width]);
                if (is_sankey) {
                    y.domain([d.children_min_y0, d.children_max_y1])
                } else {
                    y.domain([d[y0], d[y1]]);
                }
            } else {
                let min_y = d.depth ? self.height / 10 : 0;
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
                sankey_cliprect_objects.transition()
                    .duration(self.opts.transitionDuration)
                    .call(sankey_clip_rects, x, y)

                sankey_path_objects.transition()
                    .duration(self.opts.transitionDuration)
                    .call(link_me, x, y)
                    .filter(d1 => d1.depth <= d.depth)
                    .attr("visibility", "hidden")
            }

            rect_objects.transition()
                .duration(self.opts.transitionDuration)
                .call(rects, x, y)
                .filter(d1 => d1 === d.parent).call(parent_rect, x, y)

            text_objects.transition()
                .duration(self.opts.transitionDuration)
                .attr("visibility", d => {
                    return (y(d[y1]) - y(d[y0]) > self.opts.minText ? "visible" : "hidden");
                })
                .call(set_texts, x, y)

            if (self.opts.showNumbers && self.opts.numbersOnNextLine)
                tspan_objects.transition()
                .duration(self.opts.transitionDuration)
                .call(set_tspans, x, y)
        }

        const keydown = function() {
            const keyCode = d3.event.keyCode;
            if (!self.current_node) {
                self.current_node = self.root;
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
                    if (self.current_node.parent && self.current_node != self.selected_node) {
                        mouseover(self.current_node.parent);
                    };
                    break; // left
                case 38: // up
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
                    break; // up
                case 39: //right
                    if (self.current_node.children) {
                        mouseover(self.current_node.children[0]);
                    };
                    break; // right
                case 40: //down
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

        const horizontal_links = function(selection, x = identity, y = identity) {
            const lh = d3.linkHorizontal();
            selection
                .attr("visibility", null)
                .attr('d', d => {
                    if (d.parent) {
                        return [lh({
                                source: [x(d.parent[x0]) + self.opts.sankeyNodeSize + 1, y(d.parent[y0] + d.sibling_y0s)],
                                target: [x(d[x0]) - 1, y(d[y0])]
                            }),
                            [x(d[x0]) - 1, y(d[y0] + d.h)],
                            lh({
                                source: [x(d[x0]) - 1, y(d[y0] + d.h)],
                                target: [x(d.parent[x0]) + self.opts.sankeyNodeSize + 1,
                                    y(d.parent[y0] + d.sibling_y0s + d.h)
                                ]
                            }).slice(1)
                        ].join(" L ");
                    }
                })
        }

        const vertical_links = function(selection, x = identity, y = identity) {
            const lv = d3.linkVertical();
            selection
                .attr("visibility", null)
                .attr('d', d => {
                    if (d.parent) {
                        return [lv({
                                source: [x(d.parent[x0] + d.sibling_x0s), y(d.parent[y0]) + self.opts.sankeyNodeSize + 1],
                                target: [x(d[x0]), y(d[y0]) - 1]
                            }),
                            [x(d[x0] + d.w), y(d[y0]) - 1],
                            lv({
                                source: [x(d[x0] + d.w), y(d[y0]) - 1],
                                target: [x(d.parent[x0] + d.sibling_x0s + d.w),
                                    y(d.parent[y0]) + self.opts.sankeyNodeSize + 1
                                ]
                            }).slice(1)
                        ].join(" L ");
                    }
                })
        }

        const link_me = horizontal ? horizontal_links : vertical_links

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
                .append("rect")
                .call(sankey_clip_rects);

            // add Sankey rects
            rect_objects = partition_group1.append("rect")
                .call(sankey_rects);

            // add Sankey links
            sankey_path_objects = partition_group1.append('path')
                .on("click", d => clicked(d))
                .on("mouseover", d => {
                    mouseover(d)
                })
                .on("mouseout", mouseout)
                .style("cursor", "pointer")
                .style('fill', d => self._color(self.opts.linkColorChild ? d : d.parent))
                .call(link_me);
        } else {
            rect_objects = partition_group1.append("rect")
                .attr("id", (_, i) => "rect-" + i + self.ID)
                .call(rects)

            partition_group1.append("clipPath")
                .attr("id", (d, i) => "clip-" + i + self.ID)
                .append("use")
                .attr("xlink:href", (_, i) => "#rect-" + i + self.ID);
        }

        var min_val = this.root.value / 100;

        /*    if (is_sankey) {
                text
                    .filter(d => d.children_max_y1 - d.children_min_y0 < 10)
                    .attr("visibility", "hidden")
            }*/

        text_group1.attr("clip-path", (_, i) => "url(#clip-" + i + self.ID + ")")

        text_objects
            .attr("visibility", d => {
                return (d[y1] - d[y0] >= self.opts.minText ? "visible" : "hidden");
            })
            .call(set_texts)
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
                tspan_objects.call(set_tspans)
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
                    const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                        yd = d3.interpolate(y.domain(), [d.y0, 1]);
                    return t => {
                        x.domain(xd(t));
                        y.domain(yd(t));
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
