HTMLWidgets.widget({

    name: 'hiervis',

    type: 'output',

    factory: function(el, width, height) {
        var el = el;

        const showBreadcrumb = true;
        var breadcrumb_svg = d3.select(el).append('svg')
            .attr("class", "breadcrumbs")
            .attr("width", width);
        var hiervis_svg = d3.select(el).append("svg")
            .attr("class", "hiervis")
            .attr("width", width)
            .attr("height", height);
        var selected;

        var wrapWidth = 1000;
        var sel_path;

        const isShiny = typeof Shiny !== "undefined"  

        return {
            renderValue: function(x) {
                var chart = hiervis(hiervis_svg, x.data, x.opts);

                if (chart.dispatch) {
                    chart.dispatch.on("mouseover", d => { 
                        if (showBreadcrumb && d)
                            breadcrumb.show(d);
                        if (isShiny)
                            Shiny.onInputChange(el.id + '_hover', JSON.stringify(d)); 
                    });
                    chart.dispatch.on("mouseout", d => { 
                        if (showBreadcrumb)
                            if (selected)
                                breadcrumb.show(selected)
                            else
                                breadcrumb.hide()
                        if (isShiny)
                            Shiny.onInputChange(el.id + '_clicked', JSON.stringify(selected)); 
                    });
                    chart.dispatch.on("clicked", d => { 
                        selected = d;
                        if (showBreadcrumb)
                            breadcrumb.show(selected)
                        if (isShiny)
                            Shiny.onInputChange(el.id + '_clicked', JSON.stringify((d))); 
                    });
                } else {
                    console.log("chart.dispatch is NULL");
                    console.log(chart)
                }

                var breadcrumb = d3.breadcrumb()    
                    .container(breadcrumb_svg)
                    .fontSize(12).height(25).padding(5).wrapWidth(1000)
                    .top(5).marginTop(1).width(10);

                // this message handler currently does not work - requires refactoring
                //  of hiervis.js module
                if (isShiny) {
                    Shiny.addCustomMessageHandler(el.id + "_goUp", n => { chart.goUp(n) })
                }

                chart.draw(x.vis)

            },

            resize: function(width, height) {
                hiervis_svg.attr("width", width).attr("height", height)
            }

        };
    }
});
