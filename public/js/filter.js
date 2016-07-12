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
    {id: "#delta_cost-box", key:"Delta_Cost", type: "sum"},
    {id: "#winter-box", key:"Winter", type: "sum"},
    {id: "#Monday-box", key:"Monday", type: "sum"},
    {id: "#Tuesday-box", key:"Tuesday", type: "sum"},
    {id: "#Wednesday-box", key:"Wednesday", type: "sum"},
    {id: "#Thursday-box", key:"Thursday", type: "sum"},
    {id: "#Friday-box", key:"Friday", type: "sum"},
    {id: "#Saturday-box", key:"Saturday", type: "sum"},
    {id: "#Sunday-box", key:"Sunday", type: "sum"},

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

    var datasetId = window.location.pathname.split("/")[window.location.pathname.split("/").length-1];
    var command = "distinct"

    var qString = "key=" + oOptions[options_index].key;

    $.ajax("/privateQuery/" + datasetId + "/" + command + "/" + qString + "/true").done(function (res) {

    //$.ajax("https://q.nqminds.com/v1/datasets/" + dataset + "/distinct?access_token=" + accessToken + "&key=" + oOptions[options_index].key).done(function(res){

        for(var data_index in res.data){

            var value = res.data[data_index];
            var text = res.data[data_index];

            //replace nid with names
            if(oOptions[options_index].key=="NID"){

                text = "";
                 for (var i = 0; i < value.length; i++) {
                    if(value[i] == "0"){
                        text += hwrcLookup[i].HWRC + ", "
                    }
                }
                if(text.length > 0){
                    text = text.slice(0, -2)
                }
                text = "(" + text + ")"
            }

            $(oOptions[options_index].id).append($('<option>', {value: value,  text: text}))
        }
        $('select').material_select();
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

    //console.log("populate filter form pipeline: " + pipeline)

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
    var matchFlag = false;

    var sMatch = '{"$match":{"$and":[';

    for(var options_index in oOptions){

        var id = oOptions[options_index].id;
        var key = oOptions[options_index].key;

        var arr = $(id).val();

        var subMatch = '{"$or":[';

        for(var arr_index in arr){
            subMatch += '{"' + key + '":"' + arr[arr_index] + '"},';
        }
        subMatch = subMatch.slice(0, -1);
        subMatch += ']}';

        if(arr.length > 0){
            matchFlag = true;
            sMatch += subMatch + ','
        }



    }

    sMatch = sMatch.slice(0, -1);
    sMatch += ']}},';

    //hack for empty match
    //todo deal with empty match
    if(matchFlag == false){sMatch = '{"$match":{"$and":[{"$or":[{"SID":"2015"},{"SID":"2021"}]}]}},' }

    //console.log("match: " + sMatch)

    //GROUP

    groupFlag = false;

    var sGroup = '{"$group":{';

    //Group Id
    sGroup += '"_id":{';

    for(var check_index in oCheck){

        var id = oCheck[check_index].id;
        var key = oCheck[check_index].key;
        var type = oCheck[check_index].type;

        if(type == "_id" && $(id).is(":checked")){
            groupFlag = true;
            sGroup += '"' + key + '":"$' + key + '",'
        }

    }

    sGroup = sGroup.slice(0, -1);
    sGroup += '},';

    //console.log(sGroup)

    if(groupFlag == false){
        Materialize.toast('You must select at least one column!', 4000, 'filterAlert')
    }

    //Sort
    var sSort = '';


    //Group Sum

    sumFlag = false;

    for(var check_index in oCheck){

        var id = oCheck[check_index].id;
        var key = oCheck[check_index].key;
        var type = oCheck[check_index].type;

        if(type == "sum" && $(id).is(":checked")){
            sumFlag = true;
            sGroup += '"' + key + '":{"$sum":"$' + key + '"},';


            //take the first sum field for sorting
            if(sSort.length == 0){
                sSort = ',{"$sort":{"' + key + '":1}}';
            }
        }
    }

    sGroup = sGroup.slice(0, -1);
    sGroup += '}}';

    if(sumFlag == false){
        Materialize.toast('You must select at least one data type!', 4000, 'filterAlert')
    }

    url += sMatch + sGroup + sSort;

    url += ']';

    console.log(url)

    if(groupFlag == true && sumFlag == true) {
        window.open(url, "_self")
    }

};


var populate_map_form = function(){

    //populate options

    next_select(0, oMapOptions, function (res) {

        
        if ($("#nid_select").val().length == 0) {
            $("#nid_map_select").val("11111111111111111111111111")
        } else {
            $("#nid_select").val()[0]
        }

        get_district_data(function(districtData, districtRanks){
            get_hwrc_data(function(poiData, poiMax){
                ee.emitEvent("update_map", [districtData, districtRanks, poiData, poiMax]);
            })
        })


    });
};

var update_map_nid = function(bit_index){

    //document.getElementById("mapContainer").setAttribute("style","-webkit-filter:blur(2px)");

    var current_nid = $("#nid_map_select").val();

    var bit = current_nid.charAt(bit_index);
    if(bit == 0){
        bit = 1;
    } else {
        bit = 0;
    }

    var new_nid = current_nid.substr(0, bit_index) + bit + current_nid.substr(bit_index + 1 );


    oSelect = document.getElementById("nid_map_select");
    for(var i = 0; i < oSelect.length; i++) {
        if(oSelect.options[i].value == new_nid) {
            oSelect.options[i].selected = true;

            $('select:not([multiple])').material_select();

            get_district_data(function(districtData, districtRanks){
                get_hwrc_data(function(poiData, poiMax){
                    //document.getElementById("mapContainer").setAttribute("style","-webkit-filter:blur(none)");
                    ee.emitEvent("update_map", [districtData, districtRanks, poiData, poiMax]);
                });
            });
            get_nid_data(function(total_cost, rank, ranks_count){
                ee.emitEvent("update_map_text", [total_cost, rank, ranks_count])
            });
        }
    }
};

var table_set_nid = function (row, obj) {

    console.log(row)
    console.log(obj.data[row]._id)




    //get the column

};

ee.addListener("update_map_nid", update_map_nid);


ee.addListener("update_map_nid", function(){
    document.getElementById("mapContainer").setAttribute("style","-webkit-filter:blur(2px)");
});
ee.addListener("update_map", function(){
    document.getElementById("mapContainer").setAttribute("style","-webkit-filter:blur(none)");
});


