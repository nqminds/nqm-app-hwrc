/**
 * Created by leovalberg on 01/06/2016.
 */

var oOptions = [
    {id: "#sid_select", key: "SID"},
    {id: "#nid_select", key: "NID"},
    {id: "#hwrc_select", key: "HWRC"},
    {id: "#waste_select", key: "Waste_Type"},
    {id: "#move_select", key: "First_Movement"},
    {id: "#contract_select", key: "Contract"}
];

var oCheck = [
    {id: "#sid-box", key:"SID", type: "_id"},
    {id: "#nid-box", key:"NID", type: "_id"},
    {id: "#hwrc-box", key:"HWRC", type: "_id"},
    {id: "#waste-box", key:"Waste_Type", type: "_id"},
    {id: "#move-box", key:"First_Movement", type: "_id"},
    {id: "#contract-box", key:"Contract", type: "_id"},
    {id: "#tonnage-box", key:"Tonnage", type: "sum"},
    {id: "#delta_tonnage-box", key:"Delta_Tonnage", type: "sum"},
    {id: "#cost-box", key:"Cost", type: "sum"},
    {id: "#delta_cost-box", key:"Delta_Cost", type: "sum"}
];

var oMapOptions = [
    {id: "#sid_map_select", key: "SID"},
    {id: "#nid_map_select", key: "NID"}
];


// ********************* read url

var getPipeline = function() {
    var url = window.location.href;
    name = "pipeline";
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
};

var next_select = function(options_index, oOptions, callback){

    if(options_index < oOptions.length){
        populate_select(options_index, oOptions, function(options_index, oOptions){
            options_index ++;
            next_select(options_index, oOptions, callback)
        })
    } else {

        callback("done")

    }


};


var populate_select = function(options_index, oOptions, callback){

    var path = window.location.pathname;

        $.ajax("https://q.nqminds.com/v1/datasets" + path + "distinct?key=" + oOptions[options_index].key).done(function(res){
            for(var data_index in res.data){
                $(oOptions[options_index].id).append($('<option>', {value: res.data[data_index],  text: res.data[data_index]}))
            }
            callback(options_index, oOptions)

    })
};


var populate_filter_form1 = function(){

    //populate options

    next_select(0, oOptions, function(res){
        populate_filter_form2(oOptions)
    });
};


var get_pipeline_component = function(key, pipeline){
    return  pipeline.filter(function(el){
        if(el.hasOwnProperty(key)){
            return el[key]
        }
    });
};


var flatten = function(data) {
    var result = [];
    function recurse (cur, prop) {
        if (Object(cur) !== cur) {
            var o = {};
            o[prop.split(".")[prop.split(".").length - 1]] = cur;
            result.push(o);
        } else if (Array.isArray(cur)) {
            for(var i=0, l=cur.length; i<l; i++)
                recurse(cur[i], prop ? prop+"."+i : ""+i);
            if (l == 0)
                result[prop] = [];
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop+"."+p : p);
            }
            if (isEmpty)
                result[prop] = {};
        }
    }
    recurse(data, "");
    return result;
}


var populate_filter_form2 = function(oOptions){


    //populate option selections
    var url = window.location.href;
    var pipeline = JSON.parse(getPipeline());

    match = get_pipeline_component("$match", pipeline)[0]["$match"];
    aMatch = flatten(match);

    for(var option_index in oOptions){

        var key = oOptions[option_index].key;
        var id = oOptions[option_index].id;

        for(var match_index in aMatch){
            if(aMatch[match_index].hasOwnProperty(key)){
                oSelect = document.getElementById(id.slice(1))
                for(var i = 0; i < oSelect.length; i++) {
                    if(oSelect.options[i].value == aMatch[match_index][key]) {
                        oSelect.options[i].selected = true;
                    }
                }
            }
        }
    }

    //$('select').material_select();

    //populate check boxes
    group = get_pipeline_component("$group", pipeline)[0]["$group"];

    //populate group entity columns
    for(var check_index in oCheck){
        var key = oCheck[check_index].key;
        var id = oCheck[check_index].id;

        if(group.hasOwnProperty(key) || group._id.hasOwnProperty(key)){
            $(id).prop("checked", true);
        } else {
            $(id).prop("checked", false);
        }

    }

    $('select').material_select();

};


//
// **************** write url

var generate_url = function(){

    var url = window.location.origin + window.location.pathname + '?pipeline=[';


    //MATCH
    var sMatch = '{"$match":{"$and":[';

    for(var options_index in oOptions){
        var id = oOptions[options_index].id;
        var key = oOptions[options_index].key;

        var arr = $(id).val();

        var subMatch = '{"$or":[';

        for(var arr_index in arr){
            subMatch += '{"' + key + '":"' + arr[arr_index] + '"},';
            //if(arr_index < arr.length - 1){
            //    subMatch += ','
            //}
        }
        subMatch = subMatch.slice(0, -1);
        subMatch += ']}';

        if(arr.length > 0){
            sMatch += subMatch + ','
        }



    }

    sMatch = sMatch.slice(0, -1);
    sMatch += ']}},';


    //GROUP

    var sGroup = '{"$group":{';

    //Group Id
    sGroup += '"_id":{';

    for(var check_index in oCheck){

        var id = oCheck[check_index].id;
        var key = oCheck[check_index].key;
        var type = oCheck[check_index].type;

        if(type == "_id" && $(id).is(":checked")){
            sGroup += '"' + key + '":"$' + key + '",'
        }

    }

    sGroup = sGroup.slice(0, -1);
    sGroup += '},';

    //Sort
    var sSort = '';




    //Group Sum

    for(var check_index in oCheck){

        var id = oCheck[check_index].id;
        var key = oCheck[check_index].key;
        var type = oCheck[check_index].type;

        if(type == "sum" && $(id).is(":checked")){
            sGroup += '"' + key + '":{"$sum":"$' + key + '"},';


            //take the first sum field for sorting
            if(sSort.length == 0){
                sSort = ',{"$sort":{"' + key + '":1}}';
            }
        }
    }

    sGroup = sGroup.slice(0, -1);
    sGroup += '}}';

    url += sMatch + sGroup + sSort;

    url += ']';

    //console.log(url)

    window.open(url,"_self")

};


var populate_map_form = function(){

    //populate options

    next_select(0, oMapOptions, function(res){

        get_district_data(function(districtData){
            get_hwrc_data(function(poiData){
                ee.emitEvent("update_map", [districtData, poiData]);
            })
        })


    });
};

